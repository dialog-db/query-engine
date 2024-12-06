import * as API from './api.js'
import * as Link from './link.js'
import * as Bytes from './bytes.js'

export { Link, Bytes }

/**
 * @param {unknown} value
 * @returns {value is API.Constant}
 */
export const is = (value) => {
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'bigint':
    case 'boolean':
      return true
    case 'object':
      return value === null || value instanceof Uint8Array || Link.is(value)
    default:
      return false
  }
}

/**
 * @param {API.Constant} self
 * @param {API.Constant} other
 */
export const equal = (self, other) => {
  if (self === other) {
    return true
  } else if (self instanceof Uint8Array) {
    return other instanceof Uint8Array && Bytes.equal(self, other)
  } else if (Link.is(self)) {
    return Link.is(other) && Link.equal(self, other)
  } else {
    return false
  }
}

/**
 *
 * @param {API.Constant} self
 */
export const toJSON = (self) => {
  if (self instanceof Uint8Array) {
    return Bytes.toJSON(self)
  } else if (Link.is(self)) {
    return Link.toJSON(self)
  } else {
    return self
  }
}

/**
 * @param {API.Constant} self
 */
export const toString = (self) => {
  if (self === null) {
    return 'null'
  } else if (self instanceof Uint8Array) {
    return Bytes.toString(self)
  } else if (Link.is(self)) {
    return Link.toString(self)
  } else {
    return String(self)
  }
}

/**
 * @param {API.Constant} self
 * @param {API.Constant} other
 */
export const compare = (self, other) =>
  toString(self).localeCompare(toString(other))

/**
 * @param {API.Constant} actual
 * @param {API.Constant} expected
 * @param {API.Bindings} scope
 */
export const unify = (actual, expected, scope) =>
  actual === expected || equal(actual, expected)
    ? { ok: scope }
    : { error: new RangeError(`Expected ${expected} got ${actual}`) }
