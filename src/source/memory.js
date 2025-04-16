import * as API from '../api.js'
import { Constant } from '../lib.js'
import * as Link from '../data/link.js'
import * as Fact from '../fact.js'

/**
 * @param {{}} source
 */
export const entity = (source) => Link.of(source)

/**
 * @param {Iterable<API.Fact|API.Instantiation>} source
 * @returns {API.Querier & API.Transactor<{}>}
 */
export const create = (source = []) => {
  const memory = new Memory()
  const cause = version(memory.model)
  for (const entry of source) {
    if (Array.isArray(entry)) {
      const fact = /** @type {API.Fact} */ (entry)
      associate(memory, [...fact, cause])
    } else {
      for (const fact of Fact.derive(
        /** @type {API.Instantiation} */ (entry)
      )) {
        associate(memory, [...fact, cause])
      }
    }
  }

  return memory
}

/**
 * @param {[API.Entity|null, API.Attribute|null, API.Constant|null]} model
 */
export const toLink = ([entity, attribute, value]) =>
  Link.of([entity, attribute, value])

/**
 * @param {[API.Entity|null, API.Attribute|null, API.Constant|null]} model
 */
export const toKey = (model) => toLink(model).toString()

/**
 * @param {Model} model
 * @param {API.FactsSelector} selector
 * @returns {API.Task<API.Datum[], Error>}
 */
export const select = function* (model, { the, of, is }) {
  const key = toLink([of ?? null, the ?? null, is ?? null])
  return Object.values(model.index[key.toString()] ?? {})
}

/**
 * @param {Model} model
 * @param {API.Transaction} transaction
 * @returns {API.Task<{}, Error>}
 */
export const transact = function* (model, transaction) {
  const cause = version(model)
  for (const instruction of transaction) {
    if (instruction.Assert) {
      associate(model, [...instruction.Assert, cause])
    } else if (instruction.Retract) {
      dissociate(model, instruction.Retract)
    } else if (instruction.Import) {
      for (const fact of Fact.derive(instruction.Import)) {
        associate(model, [...fact, cause])
      }
    }
  }

  return model
}

/**
 *
 * @param {API.Fact} fact
 */

const toKeys = ([entity, attribute, value]) => [
  // by entity
  toKey([entity, null, null]),
  toKey([entity, attribute, null]),
  toKey([entity, null, value]),
  // by attribute
  toKey([null, attribute, null]),
  toKey([null, attribute, value]),
  // by value
  toKey([null, null, value]),
  // everything
  toKey([null, null, null]),
]

/**
 * @param {Model} db
 */
export const version = ({ data }) => Link.of(data)

/**
 * @typedef {object} Model
 * @property {Record<string, API.Datum>} data
 * @property {Record<string, Record<string, API.Datum>>} index
 *
 *
 * @param {Model} data
 * @param {API.Datum} datum
 */
const associate = ({ data, index }, datum) => {
  const [entity, attribute, value] = datum
  // derive the fact identifier from the fact data
  const id = toKey([entity, attribute, value])

  // If the fact is not yet known we need to store it and index it.
  if (!(id in data)) {
    data[id] = datum

    // We also index new fact by each of its components so that we can
    // efficiently query by entity, attribute or value.
    const keys = [id, ...toKeys([entity, attribute, value])]

    for (const key of keys) {
      // If we already have some facts in this index we add a new fact,
      // otherwise we create a new index.
      const store = index[key]
      if (store) {
        store[id] = datum
      } else {
        index[key] = { [id]: datum }
      }
    }
  }

  return id
}

/**
 * @param {Model} data
 * @param {API.Fact} fact
 */
export const dissociate = ({ data, index }, fact) => {
  const [entity, attribute, value] = fact
  // derive the fact identifier from the fact data
  const id = toKey([entity, attribute, value])

  // If the fact is not yet known we need to store it and index it.
  if (id in data) {
    delete data[id]

    // We also need to delete fact from the index.
    const keys = [id, ...toKeys([entity, attribute, value])]

    for (const key of keys) {
      // If we already have some facts in this index we add a new fact,
      // otherwise we create a new index.
      delete index[key][id]
    }
  }
}

class Memory {
  constructor() {
    /** @type {Model} */
    this.model = {
      data: Object.create(null),
      index: Object.create(null),
    }
  }
  get index() {
    return this.model.index
  }
  get data() {
    return this.model.data
  }

  get version() {
    return version(this.model)
  }

  /**
   * @param {API.Transaction} transaction
   */
  transact(transaction) {
    return transact(this.model, transaction)
  }

  /**
   * @param {API.FactsSelector} selector
   */
  select(selector) {
    return select(this, selector)
  }
}
