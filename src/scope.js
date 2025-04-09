import * as API from './api.js'
import * as Cursor from './cursor.js'
import { _ } from './$.js'

/**
 * @implements {API.Scope}
 */
class Scope {
  /**
   *
   * @param {API.Cursor} references
   * @param {API.QueryBindings} bindings
   */
  constructor(references = new Map(), bindings = new Map()) {
    this.references = references
    this.bindings = bindings
  }
}

export const free = new Scope(
  Object.freeze(new Map()),
  Object.freeze(new Map())
)

/**
 * Creates a new scope from the provided one by copying sharing references and
 * copying bindings.
 *
 * @param {API.Scope} scope
 * @returns {API.Scope}
 */
export const fork = (scope) =>
  new Scope(scope.references, new Map(scope.bindings))

/**
 * Creates a deep copy of the provided scope.
 *
 * @param {API.Scope} scope
 * @returns {API.Scope}
 */
export const clone = (scope) =>
  new Scope(new Map(scope.references), new Map(scope.bindings))

/**
 * Creates a new scope, optionally takes references and bindings.
 *
 * @param {API.Cursor} [references]
 * @param {API.QueryBindings} [bindings]
 * @returns {API.Scope}
 */
export const create = (references = new Map(), bindings = new Map()) =>
  new Scope(references, bindings)

/**
 * Returns true if the variable is bound in this context.
 *
 * @param {API.Scope} scope
 * @param {API.Variable} variable
 */
export const isBound = (scope, variable) =>
  Cursor.has(scope.bindings, scope.references, variable)

/**
 * Returns the value of the variable in this context.
 *
 * @template {API.Scalar} T
 * @param {API.Scope} scope
 * @param {API.Term<T>} variable
 * @returns {T|undefined}
 */
export const get = (scope, variable) =>
  Cursor.get(scope.bindings, scope.references, variable)

/**
 * Assigns given value to the given variable in the given `scope`. Throws an
 * error if the variable is already assigned to a different value.
 *
 * @template {API.Scalar} T
 * @param {API.Scope} scope
 * @param {API.Variable<T>} variable
 * @param {T} value
 * @returns {void}
 */
export const set = (scope, variable, value) =>
  Cursor.set(scope.bindings, scope.references, variable, value)
