import * as API from './api.js'
import { is as isLink } from './data/link.js'

/**
 * Checks given `value` against the given `type` and returns `true` if type
 * matches. Function can be used as [type predicate].
 *
 * [type predicate]: https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates
 *
 * @example
 *
 * ```ts
 * export const demo = (value: Constant) => {
 *   if (Type.isTypeOf(Type.String, value)) {
 *     // type was narrowed down to string
 *     console.log(value.toUpperCase())
 *   }
 * }
 * ```
 *
 * @template {API.Scalar} T
 * @param {API.Type<T>} type
 * @param {API.Scalar} value
 * @returns {value is T}
 */
export const isTypeOf = (type, value) => !unify(type, infer(value)).error

/**
 * Checks given `value` against the given `type` and returns either an ok
 * result or type error.
 *
 * @template {API.Scalar} T
 * @param {API.Type<T>} type
 * @param {API.Scalar} value
 * @returns {API.Result<API.Type, TypeError>}
 */
export const check = (type, value) => unify(type, infer(value))

/**
 * Attempts to unify give types and returns error if types can not be unified
 * or the unified type.
 *
 * @param {API.Type} type
 * @param {API.Type} other
 * @returns {API.Result<API.Type, TypeError>}
 */
export const unify = (type, other) => {
  const expect = toTypeName(type)
  const actual = toTypeName(other)
  if (expect === actual) {
    return { ok: type }
  } else {
    return {
      error: new TypeError(`Expected type ${expect}, instead got ${actual}`),
    }
  }
}

/**
 * Infers the type of the given constant value. It wil throw an exception at
 * runtime if the value passed is not a constant type, which should not happen
 * if you type check the code but could if used from unchecked JS code.
 *
 * @param {API.Scalar} value
 * @returns {API.Type}
 */
export const infer = (value) => {
  switch (typeof value) {
    case 'boolean':
      return Boolean
    case 'string':
      return String
    case 'bigint':
      return Integer
    case 'number':
      return (
        Number.isInteger(value) ? Integer
        : Number.isFinite(value) ? Float
        : unreachable(`Number ${value} can not be inferred`)
      )
    default: {
      if (value instanceof Uint8Array) {
        return Bytes
      } else if (isLink(value)) {
        return Referenece
      } else if (value === null) {
        return Null
      } else {
        throw Object.assign(new TypeError(`Object types are not supported`), {
          value,
        })
      }
    }
  }
}

/**
 * Returns JSON representation of the given type.
 *
 * @template {API.Scalar} T
 * @param {API.Type<T>} type
 * @returns {API.Type<T>}
 */
export const toJSON = (type) => /** @type {any} */ ({ [toString(type)]: {} })

/**
 * Returns string representation of the given type.
 *
 * @param {API.Type} type
 */
export const toString = (type) => toTypeName(type)

export { toJSON as inspect }

/**
 * Returns the discriminant of the given type.
 *
 * @param {API.Type} type
 * @returns {API.TypeName}
 */
export const toTypeName = (type) => {
  if (type.Boolean) {
    return 'boolean'
  } else if (type.Bytes) {
    return 'bytes'
  } else if (type.Float) {
    return 'float'
  } else if (type.Integer) {
    return 'integer'
  } else if (type.Reference) {
    return 'reference'
  } else if (type.String) {
    return 'string'
  } else if (type.Null) {
    return 'null'
  } else {
    throw new TypeError(`Invalid type ${type}`)
  }
}

/**
 * @param {API.Type} type
 * @returns {{[Case in keyof API.Type]: [Case, Unit, {[K in Case]: Unit}]}[keyof API.Type & string] & {}}
 */
export const match = (type) => {
  if (type.Boolean) {
    return ['Boolean', type.Boolean, type]
  } else if (type.Bytes) {
    return ['Bytes', type.Bytes, type]
  } else if (type.Float) {
    return ['Float', type.Float, type]
  } else if (type.Integer) {
    return ['Integer', type.Integer, type]
  } else if (type.Reference) {
    return ['Reference', type.Reference, type]
  } else if (type.String) {
    return ['String', type.String, type]
  } else if (type.Null) {
    return ['Null', type.Null, type]
  } else {
    throw new TypeError(`Invalid type ${type}`)
  }
}

/**
 * @param {string} message
 * @returns {never}
 */
export const unreachable = (message) => {
  throw new Error(message)
}

export const Unit = /** @type {API.Unit} */ Object.freeze({})
export const Null = /** @type {API.Type<API.Null>} */ ({ Null: { order: 0 } })
export const Boolean = /** @type {API.Type<boolean>} */ ({
  Boolean: { order: 1 },
})
export const Integer = /** @type {API.Type<API.Integer>} */ ({
  Integer: { order: 2 },
})

export const Float = /** @type {API.Type<API.Float>} */ ({
  Float: { order: 4 },
})

export const String = /** @type {API.Type<string>} */ ({ String: { order: 5 } })

export const Bytes = /** @type {API.Type<API.Bytes>} */ ({
  Bytes: { order: 6 },
})
export const Referenece = /** @type {API.Type<API.Reference>} */ ({
  Reference: { order: 9 },
})
