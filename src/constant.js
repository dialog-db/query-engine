import * as API from './api.js'
import * as Link from './link.js'
import * as Bytes from './bytes.js'
import * as Entity from './entity.js'

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
      return value === null || value instanceof Uint8Array || Entity.is(value)
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
  } else if (Entity.is(self)) {
    return Entity.is(other) && Entity.equal(self, other)
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
  } else if (Entity.is(self)) {
    return Entity.toJSON(self)
  } else {
    return self
  }
}

/**
 * @param {API.Constant} value
 */
export const entropy = (value) => {
  switch (typeof value) {
    case 'boolean':
      return 1 // 2 possible values = 1 bit
    case 'number':
      return 64 // IEEE 754 double = 64 bits
    case 'bigint': {
      // Get actual bytes needed to represent this bigint
      const size = Math.ceil(
        (value < 0 ? -value : value).toString(16).length / 2
      )
      return size * 8
    }
    case 'string': {
      // Assume UTF-8 byte length
      return value.length * 8
    }
    default: {
      if (Entity.is(value)) {
        // Assume 32 byte hashes
        return 256 // 32 bytes = 256 bits
      } else if (Bytes.is(value)) {
        return value.byteLength * 8
      } else {
        return 32 // Conservative default
      }
    }
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
  actual === expected || equal(actual, expected) ?
    { ok: scope }
  : { error: new RangeError(`Expected ${expected} got ${actual}`) }
