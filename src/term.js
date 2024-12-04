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
 * Attempts to match given `term` against the given fact `value`, if `value`
 * matches the term returns succeeds with extended `frame` otherwise returns
 * an error.
 *
 * @param {API.Term} term
 * @param {API.Constant} value
 * @param {API.Bindings} bindings
 * @returns {API.Result<API.Bindings, Error>}
 */
export const match = (term, value, bindings) =>
  // We have a special `_` variable that matches anything. Unlike all other
  // variables it is not unified across all the relations which is why we treat
  // it differently and do add no bindings for it.
  isBlank(term)
    ? { ok: bindings }
    : // All other variables get unified which is why we attempt to match them
      // against the data in the current state.
      Variable.is(term)
      ? matchVariable(term, value, bindings)
      : // If term is a constant we simply ensure that it matches the data.
        matchConstant(term, value, bindings)

/**
 * @template {API.Bindings} Bindings
 *
 * @param {API.Constant} constant
 * @param {API.Constant} value
 * @param {Bindings} frame
 * @returns {API.Result<Bindings, Error>}
 */
export const matchConstant = (constant, value, frame) =>
  constant === value || Constant.equal(constant, value)
    ? { ok: frame }
    : { error: new RangeError(`Expected ${constant} got ${value}`) }

/**
 *
 * @param {API.Variable} variable
 * @param {API.Constant} value
 * @param {API.Bindings} bindings
 * @returns {API.Result<API.Bindings, Error>}
 */
export const matchVariable = (variable, value, bindings) => {
  // Get key this variable is bound to in the context
  const key = Variable.toKey(variable)
  // If context already contains binding for we attempt to unify it with the
  // new data otherwise we bind the data to the variable.
  if (key in bindings) {
    return match(bindings[key], value, bindings)
  } else {
    const result = Variable.check(variable, value)
    return result.error ? result : Bindings.unify(variable, value, bindings)
  }
}
