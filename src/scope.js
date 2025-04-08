import * as API from './api.js'
import * as Constant from './constant.js'
import * as Variable from './variable.js'
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
  scope.bindings.has(resolve(scope, variable))

/**
 * Attempts to resolve the variable in this scope. If variable is a reference
 * it will return the variable it refers to, otherwise it will return provided
 * variable essentially treating it as local.
 *
 * @template {API.Scalar} T
 * @param {API.Scope} scope
 * @param {API.Variable<T>} variable
 * @returns {API.Variable<T>}
 */
export const resolve = ({ references }, variable) =>
  /** @type {API.Variable<T>} */ (references.get(variable) ?? variable)

/**
 * Gets a value associated with the given term in the given selection.
 *
 * @template {API.Scalar} T
 * @param {API.Scope} context
 * @param {API.Term<T>} term
 * @param {API.MatchFrame} selection
 * @returns {T|undefined}
 */
export const lookup = (context, term, selection) =>
  Variable.is(term) ? read(context, term, selection) : term

/**
 * Returns the value of the variable in this context.
 *
 * @template {API.Scalar} T
 * @param {API.Scope} scope
 * @param {API.Variable<T>} variable
 * @returns {T|undefined}
 */
export const get = (scope, variable) => read(scope, variable, scope.bindings)

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
  write(scope, variable, value, scope.bindings)

/**
 *
 * @template {API.Scalar} T
 * @param {API.Scope} context
 * @param {API.Variable<T>} variable
 * @param {API.MatchFrame} selection
 * @return {T|undefined}
 */
export const read = (context, variable, selection) =>
  /** @type {T|undefined} */ (selection.get(resolve(context, variable)))

/**
 *
 * @template {API.Scalar} T
 * @param {API.Scope} scope
 * @param {API.Variable<T>} variable
 * @param {T} value
 * @param {API.MatchFrame} selection
 */
export const write = (scope, variable, value, selection) => {
  // We ignore assignments to `_` because that is discard variable.
  if (variable !== _) {
    const target = resolve(scope, variable)
    const current = selection.get(target)
    // If currently variable is not set we set to a given value.
    if (current === undefined) {
      selection.set(target, value)
    }
    // If we do however have a value already we need to check that it is
    // consistent with value being assigned if it is not we throw an error.
    else if (!Constant.equal(current, value)) {
      throw new RangeError(
        `Can not bind ${Variable.toDebugString(
          variable
        )} to ${Constant.toDebugString(
          value
        )} because it is already bound to ${Constant.toDebugString(current)}`
      )
    }
  }
}

/**
 *
 * @param {API.Scope} scope
 * @param {API.Term} term
 * @param {API.Scalar} value
 * @param {API.MatchFrame} selection
 */
export const merge = (scope, term, value, selection) => {
  // If term is a variable we assign the value to it.
  if (Variable.is(term)) {
    write(scope, term, value, selection)
  }
  // Otherwise we ensure that term is consistent with value being assigned.
  else if (!Constant.equal(term, value)) {
    throw new RangeError(
      `Can not unify ${Constant.toDebugString(
        term
      )} with ${Constant.toDebugString(value)}`
    )
  }
}

/**
 * Creates a reference from `local` variable to a `remote`
 * variable in the given `scope`.
 *
 * @template {API.Scalar} T
 * @param {API.Scope} scope
 * @param {API.Variable<T>} local
 * @param {API.Variable<T>} remote
 */
export const link = (scope, local, remote) => {
  scope.references.set(local, remote)
}
