import * as API from './api.js'
import * as Variable from './variable.js'
import * as Constant from './constant.js'
import * as Bindings from './bindings.js'

/**
 * @param {unknown} term
 * @returns {term is API.Term}
 */
export const is = (term) => Variable.is(term) || Constant.is(term)

/**
 * @param {API.Term} term
 */
export const toJSON = (term) =>
  Variable.is(term) ? Variable.toJSON(term) : Constant.toJSON(term)

/**
 * @param {API.Term} term
 * @returns {string}
 */
export const toString = (term) =>
  Variable.is(term) ? Variable.toString(term) : Constant.toString(term)

/**
 * @param {API.Term} term
 */
export const isBlank = (term) => Variable.is(term) && Variable.isBlank(term)

/**
 * Attempts to match given `term` against the given `value`, if `value`
 * matches the term returns succeeds with extended `frame` otherwise returns
 * an error.
 *
 * @param {API.Term} term
 * @param {API.Scalar} value
 * @param {API.Bindings} bindings
 * @returns {API.Result<API.Bindings, Error>}
 */
export const match = (term, value, bindings) =>
  // We have a special `_` variable that matches anything. Unlike all other
  // variables it is not unified across all the relations which is why we treat
  // it differently and do add no bindings for it.
  isBlank(term) ? { ok: bindings }
    // All other variables get unified which is why we attempt to match them
    // against the data in the current state.
  : Variable.is(term) ? matchVariable(term, value, bindings)
    // If term is a constant we simply ensure that it matches the data.
  : Constant.unify(term, value, bindings)

/**
 *
 * @param {API.Variable} variable
 * @param {API.Scalar} value
 * @param {API.Bindings} bindings
 * @returns {API.Result<API.Bindings, Error>}
 */
export const matchVariable = (variable, value, bindings) => {
  const binding = Bindings.get(bindings, variable)
  // If we do not have a binding for the given variable we simply create a new
  // a new binding with a given `value` for the given `variable`.
  if (binding === undefined) {
    const result = Variable.check(variable, value)
    return result.error ? result : unify(variable, value, bindings)
  }
  // If variable was already bound we attempt to unify it with the provided value.
  else {
    return match(binding, value, bindings)
  }
}

/**
 * @param {API.Term} actual
 * @param {API.Term} expected
 * @param {API.Bindings} bindings
 * @returns {API.Result<API.Bindings, Error>}
 */
export const unify = (actual, expected, bindings) => {
  // If two are the same unification returns bindings without any extensions.
  if (actual === expected) {
    return { ok: bindings }
  }
  // If actual is a variable we attempt to extends bindings with substitution
  // for the `actual` variable.
  else if (Variable.is(actual)) {
    return amend(actual, expected, bindings)
  }
  // If expected is a variable we attempt to extends bindings with substitution
  // for the `expected` variable instead.
  else if (Variable.is(expected)) {
    return amend(expected, actual, bindings)
  }
  // If neither is a variable we check if they are equal, if so we return
  // bindings without extensions otherwise we return an error because values
  // can not be unified.
  else {
    return Constant.unify(actual, expected, bindings)
  }
}

/**
 * Extends bindings by adding a new binding if it is consistent with the
 * with the bindings already in the frame. If there is no binding for the
 * variable in the frame, we simply add the binding of the variable to the
 * value. Otherwise we match, in the frame, the data against the value of the
 * variable in the frame. If the stored value contains only constants, as it
 * must if it was stored during pattern matching by `extend`, then the match
 * simply tests whether the stored and new values are the same. If so, it
 * returns the unmodified frame; if not, it returns an error describing the
 * inconsistency.
 *
 * @template {API.Scalar} T
 * @param {API.Variable<T>} variable
 * @param {API.Scalar} value
 * @param {API.Bindings} bindings
 * @returns {API.Result<API.Bindings, Error>}
 */
export const extend = (variable, value, bindings) => {
  const binding = Bindings.get(bindings, variable)
  if (binding === undefined) {
    return { ok: Bindings.set(bindings, variable, value) }
  } else {
    return match(binding, value, bindings)
  }
}

/**
 * Amend is similar to {@link extend} except it allows for the passed term to
 * be a variable itself.
 *
 * @template {API.Scalar} T
 * @param {API.Variable<T>} variable
 * @param {API.Term<T>} term
 * @param {API.Bindings} bindings
 * @returns {API.Result<API.Bindings, Error>}
 */
const amend = (variable, term, bindings) => {
  const binding = Bindings.get(bindings, variable)
  if (binding !== undefined) {
    // If variable is already bound, unify the term with its value
    return unify(term, binding, bindings)
  } else if (Variable.is(term)) {
    // If variables are the same we return the bindings without any changes.
    if (Variable.equal(variable, term)) {
      return { ok: bindings }
    }

    // If the variables are different we need to unify binding of the
    // `variable` with the `term`.
    const binding = Bindings.get(bindings, term)
    if (binding !== undefined) {
      // If term is bound, unify variable with its value
      return unify(variable, binding, bindings)
    } else {
      return { ok: Bindings.set(bindings, variable, term) }
    }
  } else if (isDependent(term, variable, bindings)) {
    return { error: new RangeError(`Can not self reference`) }
  } else {
    // Otherwise create new binding
    return { ok: Bindings.set(bindings, variable, term) }
  }
}

/**
 * Checks whether the given term and variable form a cyclic dependency.
 *
 * @param {API.Term} term
 * @param {API.Variable} variable
 * @param {API.Bindings} frame
 */
const isDependent = (term, variable, frame) => {
  // We'd need to implement this at some point.
  return false
}

/**
 * @param {API.Term} term
 * @param {API.Term} to
 * @returns {0|1|-1}
 */
export const compare = (term, to) => {
  // If both are variables we compare them by variable comparison otherwise
  // non variable is greater.
  if (Variable.is(term)) {
    return Variable.is(to) ? Variable.compare(term, to) : -1
  }
  // If term is a constant and `to` is a variable return 1 as we consider
  // constant greater than variable, otherwise we compare by constants.
  else {
    return Variable.is(to) ? 1 : Constant.compare(term, to)
  }
}

/**
 * @param {API.Term} term
 */
export const toDebugString = (term) =>
  Variable.is(term) ? `${term}` : Constant.toDebugString(term)
