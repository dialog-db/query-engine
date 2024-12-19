import * as API from './api.js'
import * as Link from './link.js'
import * as Bytes from './bytes.js'
import * as Entity from './entity.js'
import * as Type from './type.js'

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
 */
export const toDebugString = (self) => {
  if (self === null) {
    return 'null'
  } else if (self instanceof Uint8Array) {
    return Bytes.toString(self)
  } else if (Link.is(self)) {
    return `${self}`
  } else {
    return JSON.stringify(self)
  }
}

/**
 * @param {API.Constant} value
 */
const toTypeOrder = (value) => {
  switch (typeof value) {
    case 'boolean':
      return BOOLEAN
    case 'number':
      return (
        Number.isInteger(value) ? INT32
        : Number.isFinite(value) ? FLOAT32
        : INT64
      )
    case 'bigint':
      return INT64
    case 'string':
      return STRING
    default:
      if (value === null) {
        return NULL
      } else if (value instanceof Uint8Array) {
        return BYTES
      } else if (Entity.is(value)) {
        return REFERENCE
      } else {
        return RECORD
      }
  }
}

const NULL = 0
const BOOLEAN = 1
const INT32 = 2
const INT64 = 3
const FLOAT32 = 4
const STRING = 5
const BYTES = 6
const RECORD = 7
const REFERENCE = 9

/**
 * @param {API.Constant} self
 * @param {API.Constant} to
 * @returns {0|-1|1}
 */
export const compare = (self, to) => {
  // If we have a same value there is no point in trying to compare
  if (self === to) {
    return 0
  }

  const selfType = toTypeOrder(self)
  const toType = toTypeOrder(to)
  if (selfType < toType) {
    return -1
  } else if (selfType > toType) {
    return 1
  }

  // Doing this so that TS will not complain about them possibly being null
  // if the both were first if would have returned already. If one of them
  // was than type comparison would have returned already.
  self = /** @type {API.Constant&{}} */ (self)
  to = /** @type {API.Constant&{}} */ (to)

  // If we got this far we have constants of the same type that are not
  // equal.
  switch (selfType) {
    // If boolean `true` is greater than `false`
    case BOOLEAN:
      return self === true ? -1 : 1
    case INT32:
    case INT64:
    case FLOAT32:
      return to ? -1 : 1
    case STRING:
      return /** @type {-1|0|1} */ (
        /** @type {string} */ (self).localeCompare(/** @type {string} */ (to))
      )
    case BYTES:
      return Bytes.compare(
        /** @type {Uint8Array} */ (self),
        /** @type {Uint8Array} */ (to)
      )
    case RECORD:
      return Link.compare(Link.of(self), Link.of(to))
    case REFERENCE:
      return Link.compare(
        /** @type {API.Entity} */ (self),
        /** @type {API.Entity} */ (to)
      )
    default:
      return 0
  }
}

/**
 * @param {API.Constant} actual
 * @param {API.Constant} expected
 * @param {API.Bindings} scope
 */
export const unify = (actual, expected, scope) =>
  actual === expected || equal(actual, expected) ?
    { ok: scope }
  : { error: new RangeError(`Expected ${expected} got ${actual}`) }
