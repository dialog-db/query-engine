import * as API from './api.js'
import * as Variable from './variable.js'
import * as Constant from './constant.js'

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
  Variable.is(term) ?
    Variable.toDebugString(term)
  : Constant.toDebugString(term)
