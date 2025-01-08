import * as API from './api.js'
import * as Variable from './variable.js'
import * as Type from './type.js'
import { entries } from './object.js'
import { and, match } from './clause.js'

/**
 * @typedef {Record<string, API.Type>} Schema
 */

/**
 * @template {API.Type} T
 * @typedef {T extends API.Type<API.Int32> ? Numeric<API.Int32> :
 *           T extends API.Type<API.Int64> ? Numeric<API.Int64> :
 *           T extends API.Type<API.Float32> ? Numeric<API.Float32> :
 *           T extends API.Type<string> ? Text :
 *           T extends API.Type<infer U> ? Attribute<U> :
 *           never} InferAttribute
 */

/**
 * @template {Schema} T
 * @typedef {{[Key in keyof T]: InferAttribute<T[Key]>}} InferAttributes
 */

/**
 * @template {Schema} [EntitySchema={}]
 * @param {EntitySchema} schema
 * @returns {{new(): Entity<EntitySchema> & InferAttributes<EntitySchema>} & API.Type<API.Entity>}
 */
export const entity = (schema = /** @type {EntitySchema} */ ({})) => {
  // @ts-ignore
  return class extends Entity {
    constructor() {
      super({
        schema,
      })
      const entity = this
      const attributes = /** @type {Record<keyof EntitySchema, Attribute>} */ (
        this
      )

      for (const [key, member] of entries(schema)) {
        const attribute = String(key)
        // If it a reference to another entity simply create an attribute for
        // the open type since we don't have exact type for the entities.
        if (
          typeof member === 'function' &&
          /** @type {{prototype: Entity<{}>}} */ (member).prototype instanceof
            Entity
        ) {
          attributes[key] = new Attribute({
            entity,
            attribute,
          })
        } else {
          const [Case, , type] = Type.match(member)
          switch (Case) {
            case 'Int32':
            case 'Int64':
            case 'Float32':
              attributes[key] = new Numeric({ entity, attribute, type })
              break
            case 'String':
              attributes[key] = new Text({ entity, attribute, type })
              break
            case 'Boolean':
            case 'Bytes':
            case 'Link':
              attributes[key] = new Attribute({ entity, attribute, type })
              break
            default:
              throw new TypeError(`Invalid type ${type}`)
          }
        }
      }
    }
  }
}

/**
 * @template {Schema} EntitySchema
 * @extends {Schema<T>}
 */
class Entity {
  /**
   * @param {object} source
   * @param {EntitySchema} source.schema
   */
  constructor({ schema }) {
    const variable = Variable.link()
    this.model = { variable, schema }
    this['?'] = variable['?']
  }
  get id() {
    return Variable.id(this.model.variable)
  }
  get type() {
    return Variable.toType(this.model.variable)
  }

  /**
   * @param {Partial<{[Key in keyof EntitySchema]: API.Term}>} pattern
   * @returns {API.Clause}
   */
  match(pattern = {}) {
    const clauses = /** @type {[...API.Clause[]]} */ ([])
    const schema = this.model.schema
    // We create fields for all attributes in the schema but that is impossible
    // to capture in static types.
    const attributes = /** @type {InferAttributes<EntitySchema>} */ (this)

    for (const [key, type] of entries(schema)) {
      const term = pattern[key] ?? attributes[key]
      // If there is a reference to an entity we include into relation, this
      // ensures that values for all entity attributes are aggregated.
      if (term instanceof Entity) {
        clauses.push(term.match())
      }

      clauses.push(/** @type {API.Clause} */ ({ Case: [this, key, term] }))
    }

    return and(...clauses)
  }
}

/**
 * @template {API.Scalar} [T=API.Scalar]
 * @implements {API.Variable<T>}
 */
class Attribute {
  /**
   * @param {object} source
   * @param {API.Term<API.Entity>} source.entity
   * @param {API.Term<API.Attribute>} source.attribute
   * @param {API.Type<T>} [source.type]
   */
  constructor({ type, ...source }) {
    const value = Variable.variable(type)
    this.model = { ...source, value }
    this['?'] = value['?']
  }

  get id() {
    return Variable.id(this.model.value)
  }

  /**
   * @returns {API.Term<API.Entity>} entity
   */
  get entity() {
    return this.model.entity
  }

  /**
   * @returns {API.Term<API.Attribute>} attribute
   */
  get attribute() {
    return this.model.attribute
  }

  match() {
    return match([this.model.entity, this.model.attribute, this])
  }

  /**
   * @param {API.Clause} clause
   */
  and(clause) {
    return this.match().and(clause)
  }

  /**
   * @param {API.Clause} clause
   */
  or(clause) {
    return this.match().or(clause)
  }

  /**
   * @param {API.Term} value
   */
  is(value) {
    return match([this.model.entity, this.model.attribute, value])
  }

  /**
   * @param {API.Term} term
   */
  of(term) {
    const array = Variable.link()
    return this.is(array).and(match([array, _, term]))
  }
  /**
   *
   * @param {API.Term} value
   */
  not(value) {
    return this.and({ Not: { Is: [this, value] } })
  }
}

/**
 * @extends {Attribute<string>}
 */
class Text extends Attribute {
  /**
   * @param {API.Term<string>} prefix
   * @returns {API.Clause}
   */
  startsWith(prefix) {
    return this.and({
      Match: [{ text: this, pattern: `${prefix}*` }, 'text/like'],
    })
  }
  /**
   * @param {API.Term<string>} suffix
   * @returns {API.Clause}
   */
  endsWith(suffix) {
    return this.and({
      Match: [{ text: this, pattern: `*${suffix}` }, 'text/like'],
    })
  }

  /**
   * @param {API.Term<string>} chunk
   */
  contains(chunk) {
    return this.and({
      Match: [{ text: this, slice: chunk }, 'text/includes'],
    })
  }
}

/**
 * @template {API.Int32|API.Int64|API.Float32} T
 * @extends {Attribute<T>}
 */
class Numeric extends Attribute {
  /**
   * @param {API.Term<T>} operand
   */
  greater(operand) {
    return this.and({
      Match: [[this, operand], '>'],
    })
  }
  /**
   * @param {API.Term<T>} operand
   */
  greaterOrEqual(operand) {
    return this.and({
      Match: [[this, operand], '>='],
    })
  }
  /**
   * @param {API.Term<T>} operand
   */
  less(operand) {
    return this.and({
      Match: [[this, operand], '<'],
    })
  }
  /**
   * @param {API.Term<T>} operand
   */
  lessOrEqual(operand) {
    return this.and({
      Match: [[this, operand], '<='],
    })
  }
}

/**
 *
 * @param {API.Term} term
 * @returns
 */
export const dependencies = function* (term) {
  // If term is a an attribute we need to ensure it is in the query so it
  // will be matched.
  if (term instanceof Attribute) {
    yield term.match()
  }
}

const { variable, link, bytes, string, integer, float, boolean, _, toKey } =
  Variable
export { variable, link, bytes, string, integer, float, boolean, _, toKey }

export { String, Int32 as Integer, Float32 as Float, Boolean } from './type.js'

/**
 * @param {API.Term<string>} text
 * @param {API.Term<string>} pattern
 * @returns {API.Clause}
 */
export const like = (text, pattern) => ({
  Match: [{ text, pattern }, 'text/like'],
})

/**
 * @param {API.Term<number>} left
 * @param {API.Term<number>} right
 * @returns {API.Clause}
 */
export const greater = (left, right) => ({
  Match: [[left, right], '>'],
})

/**
 * @param {API.Term<number>} left
 * @param {API.Term<number>} right
 * @returns {API.Clause}
 */
export const less = (left, right) => ({
  Match: [[left, right], '<'],
})

/**
 * @param {API.Term<number>} left
 * @param {API.Term<number>} right
 * @returns {API.Clause}
 */
export const greaterOrEqual = (left, right) => ({
  Match: [[left, right], '>='],
})

/**
 * @param {API.Term<number>} left
 * @param {API.Term<number>} right
 * @returns {API.Clause}
 */
export const lessOrEqual = (left, right) => ({
  Match: [[left, right], '<='],
})
