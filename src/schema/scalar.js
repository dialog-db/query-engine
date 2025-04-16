import * as API from '../api.js'
import * as Term from '../term.js'
import * as Variable from '../variable.js'
import { Schema } from './schema.js'

/**
 * @template {API.Scalar} [T=API.Scalar]
 * @extends Schema<T>
 * @implements {API.ScalarSchema<T>}
 */
export class Scalar extends Schema {
  /**
   * @param {API.TypeName|undefined} type
   * @param {API.Term<T>} selector
   * @param {T} [implicit]
   */
  constructor(type, selector, implicit) {
    super()
    this.type = type
    this.implicitValue = implicit

    this.selector = /** @type {API.InferTypeTerms<T> & API.Term<T>} */ (
      selector
    )
  }
  get where() {
    return []
  }
  /**
   * @param {API.ScalarTerms<T>} selector
   * @returns {API.MatchView<T>}
   */
  match(selector) {
    const { type } = this
    return type ?
        [
          /** @type {API.SystemOperator} */ ({
            match: {
              is: type,
              of: Term.is(selector) ? selector : selector.this,
            },
            operator: 'data/type',
          }),
        ]
      : []
  }

  get Scalar() {
    return this
  }

  /**
   * @param {T} value
   */
  implicit(value) {
    return new Scalar(this.type, value)
  }

  /**
   * @param {API.MatchFrame} bindings
   * @param {API.Term<T>} selector
   * @returns {T}
   */
  view(bindings, selector) {
    return Variable.is(selector) ?
        /** @type {T} */ (bindings.get(selector))
      : selector
  }
}

/**
 * @template {API.Scalar} [T=API.Scalar]
 * @extends {Schema<T>}
 * @implements {API.ScalarSchema<T>}
 */
export class Literal extends Schema {
  /**
   * @param {T} literal
   * @param {API.Term<T>} selector
   */
  constructor(literal, selector) {
    super()
    this.literal = literal
    this.selector = /** @type {API.InferTypeTerms<T> & API.Term<T>} */ (
      selector
    )
  }
  get where() {
    return []
  }
  /**
   * @param {API.ScalarTerms<T>} selector
   * @returns {API.MatchView<T>}
   */
  match(selector) {
    return [
      /** @type {API.SystemOperator} */ ({
        match: {
          of: this.literal,
          is: selector,
        },
        operator: '==',
      }),
    ]
  }
  get Scalar() {
    return this
  }

  /**
   * @param {API.MatchFrame} bindings
   * @param {API.Term<T>} selector
   * @returns {T}
   */
  view(bindings, selector) {
    return this.literal
  }
}
