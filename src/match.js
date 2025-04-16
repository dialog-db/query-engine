import * as API from './api.js'
import * as Variable from './variable.js'
import * as Constant from './constant.js'
import { _ } from './$.js'

/**
 * @template {API.Scalar} T
 * @param {API.Term<T>} term
 * @param {API.MatchFrame} frame
 * @returns {API.Term<T>}
 */
export const resolve = (frame, term) =>
  /** @type {API.Term<T>} */
  (frame.get(/** @type {API.Variable} */ (term)) ?? term)

/**
 * @template {API.Scalar} T
 * @param {API.MatchFrame} frame
 * @param {API.Term<T>} term
 * @returns {T|undefined}
 */
export const get = (frame, term) =>
  Variable.is(term) ? /** @type {T|undefined} */ (frame.get(term)) : term

/**
 * @template {API.Scalar} T
 * @param {API.MatchFrame} frame
 * @param {API.Variable<T>} variable
 * @param {T} value
 * @returns {API.Result<API.MatchFrame, RangeError>}
 */
export const set = (frame, variable, value) => {
  if (variable === _) {
    return { ok: frame }
  } else {
    const actual = frame.get(variable)
    if (actual === value) {
      return { ok: frame }
    } else if (actual === undefined) {
      frame.set(variable, value)
      return { ok: frame }
    } else if (Constant.equal(actual, value)) {
      return { ok: frame }
    } else {
      return {
        error: new RangeError(
          `Can not set ${Variable.toDebugString(
            variable
          )} to ${Constant.toDebugString(
            value
          )} because it is already set to ${Constant.toDebugString(actual)}`
        ),
      }
    }
  }
}

/**
 * @template {API.Scalar} T
 * @param {API.MatchFrame} frame
 * @param {API.Term<T>} term
 * @param {T} value
 * @returns {API.Result<API.MatchFrame, RangeError>}
 */
export const unify = (frame, term, value) => {
  if (Variable.is(term)) {
    return set(frame, term, value)
  } else if (term === undefined || Constant.equal(term, value)) {
    return { ok: frame }
  } else {
    throw new RangeError(
      `Can not unify ${Constant.toDebugString(
        term
      )} with ${Constant.toDebugString(value)}`
    )
  }
}

/**
 * @param {API.MatchFrame} frame
 */
export const clone = (frame) => new Map(frame)
