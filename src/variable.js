import * as API from './api.js'
import * as Type from './type.js'
import * as Constant from './constant.js'

export class Variable {
  static id = 1
  #name
  /**
   * @param {string|symbol} name
   */
  constructor(name = Symbol(), id = ++Variable.id) {
    this['?'] = { id }
    this.#name = name
  }

  get id() {
    return this['?'].id
  }
  get name() {
    return this.#name
  }
  toString() {
    return typeof this.#name === 'symbol' ?
        `?@${this.#name.description ?? this.id}`
      : `?${this.#name.toString()}`
  }
  get [Symbol.toStringTag]() {
    return this.toString()
  }
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toString()
  }

  /**
   *
   * @param {object} context
   * @param {number} context.id
   */
  with({ id }) {
    return new Variable(this.name, id)
  }
}

/**
 * @param {string|symbol} name
 */
export const create = (name) => new Variable(name)

/**
 * @type {API.Variable<any>}
 */
export const _ = create('_').with({ id: 0 })

/**
 * @param {unknown} source
 * @returns {Iterable<API.Variable>}
 */
export function* iterate(source) {
  if (is(source)) {
    yield source
  } else if (!Constant.is(source)) {
    for (const term of Object.values(source ?? {})) {
      if (is(term)) {
        yield term
      } else if (!Constant.is(term)) {
        yield* iterate(term)
      }
    }
  }
}

/**
 * @param {API.Variable} actual
 * @param {API.Variable} expected
 */
export const equal = (actual, expected) => id(actual) === id(expected)

/**
 * Predicate function that checks if given `term` is a {@link API.Variable}.
 *
 * @param {unknown} term
 * @returns {term is API.Variable}
 */
export const is = (term) =>
  typeof (/** @type {{['?']?: {id?:unknown}}} */ (term)?.['?']?.id) === 'number'

/**
 * @param {API.Variable} variable
 * @returns {API.VariableID}
 */
export const id = (variable) => variable['?'].id

/**
 * @template {API.Scalar} T
 * @param {API.Variable<T>} variable
 * @returns {API.Variable<T>}
 */
export const toJSON = (variable) => {
  const { type, id } = variable['?']
  const instance = {}
  if (type != null) {
    instance.type = Type.toJSON(type)
  }
  if (id != null) {
    instance.id = id
  }

  return { ['?']: instance }
}

export { toJSON as inspect }

/**
 * @param {API.Variable} variable
 */
export const toString = (variable) => JSON.stringify(toJSON(variable))

/**
 * @param {API.Variable} variable
 * @returns {boolean}
 */
export const isBlank = (variable) => id(variable) === 0

/**
 * @param {API.Variable} variable
 * @param {API.Variable} to
 * @returns {-1|0|1}
 */
export const compare = ({ ['?']: { id: left } }, { ['?']: { id: right } }) => {
  return (
    left < right ? -1
    : left > right ? 1
    : 0
  )
}

/**
 * @param {API.Variable} variable
 */
export const toDebugString = (variable) => {
  const name = `${variable}`.slice(1)
  return /^[a-zA-Z_]\w*$/.test(name) ?
      `$.${name}`
    : `$[${JSON.stringify(name)}]`
}
