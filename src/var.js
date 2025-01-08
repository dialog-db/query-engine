import * as API from './api.js'
import * as Type from './type.js'

/**
 * Predicate function that checks if given `term` is a {@link API.Variable}.
 *
 * @param {unknown} term
 * @returns {term is API.Variable}
 */
export const is = (term) =>
  typeof (/** @type {{['?']?: {id?:unknown}}} */ (term)?.['?']?.id) === 'number'

/**
 * @template {API.Scalar} T
 * @param {API.Variable<T>} variable
 * @returns {API.Type<T>|undefined}
 */
export const type = (variable) => variable['?'].type

/**
 * @param {API.Variable} variable
 * @returns {API.VariableID}
 */
export const id = (variable) => variable['?'].id

/**
 * @param {API.Variable} variable
 * @returns
 */
export const toKey = (variable) => `$${id(variable)}`

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
 * @template {API.Scalar} T
 * @param {API.Type<T>} [type]
 * @returns {API.Variable<T>}
 */
export const variable = (type) => new Variable(type)

export const boolean = () => variable(Type.Boolean)
export const int32 = () => variable(Type.Int32)
export const int64 = () => variable(Type.Int64)
export const float32 = () => variable(Type.Float32)
export const string = () => variable(Type.String)
export const bytes = () => variable(Type.Bytes)
export const link = () => variable(Type.Link)
export { int32 as integer, float32 as float }

/**
 * @template {API.Scalar} T
 * @implements {API.Variable<T>}
 */
class Variable {
  static id = 0

  /**
   * @param {API.Type<T>} [type]
   */
  constructor(type, id = ++Variable.id) {
    this.type = type
    this.id = id
    this['?'] = this
  }
  toJSON() {
    return toJSON(this)
  }
}

export const _ = new Variable(undefined, 0)
