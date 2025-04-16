import * as API from './api.js'
import * as Constant from './constant.js'
import * as Variable from './variable.js'
import { _ } from './$.js'
export const NOTHING = /** @type {never} */ (Symbol('NOTHING'))

/**
 * Returns true if the variable is bound in this context.
 *
 * @param {API.MatchFrame} selection
 * @param {API.Cursor} scope
 * @param {API.Variable} variable
 */
export const has = (selection, scope, variable) => {
  for (const candidate of resolve(scope, variable)) {
    if (selection.has(candidate)) {
      return true
    }
  }
  return false
}

/**
 * Attempts to resolve the variable in this scope. If variable is a reference
 * it will return the variable it refers to, otherwise it will return provided
 * variable essentially treating it as local.
 *
 * @template {API.Scalar} T
 * @param {API.Cursor} scope
 * @param {API.Variable<T>} variable
 * @returns {Iterable<API.Variable<T>>}
 */
export const resolve = function* (scope, variable) {
  const variables =
    /** @type {Set<API.Variable<T>>|undefined} */
    (scope.get(variable))

  if (variables) {
    yield* variables
  } else {
    yield variable
  }
}

/**
 * Enumerates all the variables that are equivalent to the given one in this
 * scope.
 *
 * @template {API.Scalar} T
 * @param {API.Cursor} scope
 * @param {API.Variable<T>} variable
 */
export const enumerate = function* (scope, variable) {
  for (const target of resolve(scope, variable)) {
    let found = 0
    for (const variables of scope.values()) {
      if (variables.has(target)) {
        found += variables.size
        yield* variables
      }
    }
    if (found == 0) {
      yield target
    }
  }
}

/**
 * Creates a reference from `local` variable to a `remote`
 * variable in the given `scope`.
 *
 * @template {API.Scalar} T
 * @param {API.Cursor} scope
 * @param {API.Variable<T>} local
 * @param {API.Variable<T>} remote
 */
export const link = (scope, local, remote) => {
  const variables = scope.get(local)
  if (variables == undefined) {
    // Note that we store a reference even if `local === remote` so that we
    // can iterate over the scope variables directly as opposed to having to
    // iterate over variables and then resolve them through scope.
    scope.set(local, new Set([remote]))
  } else {
    variables.add(remote)
  }
}

/**
 * @template {API.Scalar} T
 * @param {API.MatchFrame} selection
 * @param {API.Cursor} scope
 * @param {API.Variable<T>} variable
 * @return {T|undefined}
 */
export const read = (selection, scope, variable) => {
  for (const candidate of resolve(scope, variable)) {
    const value = /** @type {T|undefined} */ (selection.get(candidate))
    if (value !== undefined && value !== NOTHING) {
      return value
    }
  }
  return undefined
}

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
 * @template {API.Scalar} T
 * @param {API.MatchFrame} selection
 * @param {API.Cursor} scope
 * @param {API.Variable<T>} variable
 * @param {T} value
 */
export const set = (selection, scope, variable, value) => {
  for (const target of resolve(scope, variable)) {
    // We ignore assignments to `_` because that is discard variable.
    if (target !== _) {
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
}

/**
 * @param {API.MatchFrame} selection
 * @param {API.Cursor} scope
 * @param {API.Variable} variable
 */
export const markBound = (selection, scope, variable) =>
  set(selection, scope, variable, NOTHING)

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
