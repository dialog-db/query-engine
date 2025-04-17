import * as API from '../api.js'
import { Link } from '../constant.js'

/**
 * @param {API.Scalar} operand
 */
export const is = (operand) => [operand]

export const type =
  /**
   * @param {API.Scalar} of
   * @returns {API.TypeName[]}
   */
  (of) => {
    switch (typeof of) {
      case 'boolean':
        return ['boolean']
      case 'string':
        return ['string']
      case 'bigint':
        return ['bigint']
      case 'number':
        return (
          Number.isInteger(of) ? ['integer']
          : Number.isFinite(of) ? ['float']
          : []
        )
      default: {
        if (of === null) {
          return ['null']
        } else if (of instanceof Uint8Array) {
          return ['bytes']
        } else if (Link.is(of)) {
          return ['reference']
        } else {
          return []
        }
      }
    }
  }

/**
 * @template {API.Scalar|Record<string, API.Scalar>} T
 * @param {T} data
 */
export const refer = (data) => [Link.of(data)]

const SUCCESS = [{}]

/**
 * @template {number|string} T
 * @param {object} operands
 * @param {T} operands.this
 * @param {T} operands.than
 * @returns {{}[]}
 */
export const greater = (operands) => {
  if (operands.this > operands.than) {
    return SUCCESS
  } else {
    return []
  }
}

/**
 * @template {number|string} T
 * @param {object} operands
 * @param {T} operands.this
 * @param {T} operands.than
 * @returns {{}[]}
 */
export const less = (operands) => {
  if (operands.this < operands.than) {
    return SUCCESS
  } else {
    return []
  }
}

/**
 * @template {number|string} T
 * @param {object} operands
 * @param {T} operands.this
 * @param {T} operands.than
 * @returns {{}[]}
 */
export const greaterOrEqual = (operands) => {
  if (operands.this >= operands.than) {
    return SUCCESS
  } else {
    return []
  }
}

/**
 * @template {number|string} T
 * @param {object} operands
 * @param {T} operands.this
 * @param {T} operands.than
 * @returns {{}[]}
 */
export const lessOrEqual = (operands) => {
  if (operands.this <= operands.than) {
    return SUCCESS
  } else {
    return []
  }
}
