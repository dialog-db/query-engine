import * as API from './api.js'
import * as Constant from './constant.js'
import * as Variable from './variable.js'
import { _ } from './$.js'

/**
 * Returns true if the variable is bound in this context.
 *
 * @param {API.MatchFrame} selection
 * @param {API.Cursor} scope
 * @param {API.Variable} variable
 */
export const has = (selection, scope, variable) =>
  selection.has(resolve(scope, variable))

/**
 * Attempts to resolve the variable in this scope. If variable is a reference
 * it will return the variable it refers to, otherwise it will return provided
 * variable essentially treating it as local.
 *
 * @template {API.Scalar} T
 * @param {API.Cursor} scope
 * @param {API.Variable<T>} variable
 * @returns {API.Variable<T>}
 */
export const resolve = (scope, variable) =>
  /** @type {API.Variable<T>} */ (scope.get(variable) ?? variable)

/**
 * Creates a reference from `local` variable to a `remote`
 * variable in the given `scope`.
 *
 * @template {API.Scalar} T
 * @param {API.Cursor} scope
 * @param {API.Variable<T>} local
 * @param {API.Variable<T>} remote
 * @param {boolean} override
 */
export const link = (scope, local, remote, override = false) => {
  const current = scope.get(local)
  if (current == undefined) {
    // Note that we store a reference even if `local === remote` so that we
    // can iterate over the scope variables directly as opposed to having to
    // iterate over variables and then resolve them through scope.
    scope.set(local, remote)
  } else if (override) {
    scope.set(local, remote)
  } else if (current !== remote) {
    throw new ReferenceError(
      `Can not link ${Variable.toDebugString(
        local
      )} to ${Variable.toDebugString(
        remote
      )} because it is already linked to ${Variable.toDebugString(current)}`
    )
  }
}

/**
 * @template {API.Scalar} T
 * @param {API.MatchFrame} selection
 * @param {API.Cursor} scope
 * @param {API.Variable<T>} variable
 * @return {T|undefined}
 */
export const read = (selection, scope, variable) =>
  /** @type {T|undefined} */ (selection.get(resolve(scope, variable)))

/**
 * Gets a value associated with the given term in the given selection.
 *
 * @template {API.Scalar} T
 * @param {API.Cursor} scope
 * @param {API.Term<T>} term
 * @param {API.MatchFrame} selection
 * @returns {T|undefined}
 */
export const get = (selection, scope, term) =>
  Variable.is(term) ? read(selection, scope, term) : term

/**
 *
 * @template {API.Scalar} T
 * @param {API.MatchFrame} selection
 * @param {API.Cursor} scope
 * @param {API.Variable<T>} variable
 * @param {T} value
 */
export const set = (selection, scope, variable, value) => {
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
 * @param {API.MatchFrame} selection
 * @param {API.Cursor} scope
 * @param {API.Term} term
 * @param {API.Scalar} value
 */
export const merge = (selection, scope, term, value) => {
  // If term is a variable we assign the value to it.
  if (Variable.is(term)) {
    set(selection, scope, term, value)
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
