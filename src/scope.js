import * as API from './api.js'
import * as Variable from './variable.js'
import * as Constant from './constant.js'

const _ = Variable._

/**
 *
 * @param {API.MatchFrame} scope
 * @param {API.Variable} variable
 * @param {API.Scalar} value
 */
const bind = (scope, variable, value) => {
  // We ignore assignments to `_` because that is discard variable.
  if (variable !== _) {
    const current = scope.get(variable)
    if (current === undefined) {
      scope.set(variable, value)
    } else if (!Constant.equal(current, value)) {
      throw new RangeError(
        `Can not bind ${Variable.toDebugString(
          variable
        )} to ${Constant.toDebugString(
          value
        )} because it is already bound to ${Constant.toDebugString(value)}`
      )
    }
  }
}

/**
 * @template {API.Scalar} T
 * @param {API.Cursor} cursor
 * @param {API.Variable<T>} variable
 * @param {API.MatchFrame} scope
 * @returns {T|undefined}
 */
export const read = (cursor, variable, scope) => {
  const reference = cursor.get(variable)
  if (reference) {
    return /** @type {T|undefined} */ (scope.parent?.get(reference))
  } else {
    return /** @type {T|undefined} */ (scope.get(variable))
  }
}

/**
 * @template {API.Scalar} T
 * @param {API.Cursor} cursor
 * @param {API.Term<T>} term
 * @param {API.MatchFrame} scope
 * @returns {T|undefined}
 */
export const get = (cursor, term, scope) => {
  if (Variable.is(term)) {
    return read(cursor, term, scope)
  } else {
    return term
  }
}

/**
 * @param {API.Cursor} cursor
 * @param {API.Variable} variable
 * @param {API.Scalar} value
 * @param {API.MatchFrame} scope
 */
export const write = (cursor, variable, value, scope) => {
  const reference = cursor.get(variable)
  if (reference !== undefined) {
    const parent = /** @type {API.MatchFrame} */ (scope.parent)
    bind(parent, reference, value)
  } else {
    bind(scope, variable, value)
  }
}

/**
 * @param {API.Cursor} cursor
 * @param {API.Term} term
 * @param {API.Scalar} value
 * @param {API.MatchFrame} scope
 */
export const set = (cursor, term, value, scope) => {
  if (Variable.is(term)) {
    write(cursor, term, value, scope)
  }
}

export const create = () => new Cursor()
export const scope = () => new Scope()

/**
 * @param {API.MatchFrame} frame
 */
export const fork = (frame) => {
  const parent =
    frame.parent ? new Scope(frame.parent.parent, frame.parent) : undefined
  return new Scope(parent, frame)
}

/**
 *
 * @param {API.MatchFrame} scope
 */
export const nest = (scope) => new Scope(scope)

/**
 * @extends Map<API.Variable, API.Scalar>
 */
class Scope extends Map {
  /**
   * @param {API.MatchFrame} [parent]
   * @param {Iterable<[API.Variable, API.Scalar]>} [entries]
   */
  constructor(parent, entries) {
    super(entries)
    this.parent = parent
  }

  /**
   * @param {API.Variable} variable
   * @param {API.Scalar} value
   */
  bind(variable, value) {
    bind(this, variable, value)
  }
}

/**
 * @extends Map<API.Variable, API.Variable>
 */
class Cursor extends Map {
  /**
   * @param {API.Variable} variable
   * @param {Scope} scope
   */
  read(variable, scope) {
    return read(this, variable, scope)
  }

  /**
   * @param {API.Variable} variable
   * @param {API.Scalar} value
   * @param {Scope} scope
   */
  write(variable, value, scope) {
    return write(this, variable, value, scope)
  }
}
