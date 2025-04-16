import * as API from '../api.js'

/**
 * @param {object} operands
 * @param {API.Numeric} operands.of
 * @param {API.Numeric} operands.with
 * @returns {API.Numeric[]}
 */
export const addition = ({ of, with: by }) => {
  if (typeof of === 'number' && typeof by === 'number') {
    return [of + by]
  } else {
    return []
  }
}

/**
 * @param {object} input
 * @param {API.Numeric} input.of
 * @param {API.Numeric} input.by
 * @returns {API.Numeric[]}
 */
export const subtraction = ({ of, by }) => {
  if (typeof of === 'number' && typeof by === 'number') {
    return [of - by]
  } else {
    return []
  }
}

/**
 * @param {object} input
 * @param {API.Numeric} input.of
 * @param {API.Numeric} input.by
 * @returns {API.Numeric[]}
 */
export const multiplication = ({ of, by }) => {
  if (typeof of === 'number' && typeof by === 'number') {
    return [of * by]
  } else {
    return []
  }
}

/**
 * @param {object} input
 * @param {API.Numeric} input.of
 * @param {API.Numeric} input.by
 * @returns {API.Numeric[]}
 */
export const division = ({ of, by }) => {
  if (typeof of === 'number' && typeof by === 'number' && by !== 0) {
    return [of / by]
  } else {
    return []
  }
}

/**
 * @param {object} input
 * @param {API.Numeric} input.of
 * @param {API.Numeric} input.by
 * @returns {API.Numeric[]}
 */
export const modulo = ({ of, by }) => {
  if (typeof of === 'number' && typeof by === 'number' && by !== 0) {
    return [of % by]
  } else if (typeof of === 'bigint' && typeof by === 'bigint') {
    return [of % by]
  } else {
    return []
  }
}

/**
 * @param {object} input
 * @param {API.Numeric} input.of
 * @param {API.Numeric} input.by
 */
export const power = ({ of, by: exponent }) => {
  if (typeof of === 'number' && typeof exponent === 'number') {
    return [of ** exponent]
  } else if (typeof of === 'bigint' && typeof exponent === 'bigint') {
    return [of ** exponent]
  } else {
    return []
  }
}

/**
 * @param {number} of
 */
export const absolute = (of) => {
  if (typeof of === 'number') {
    return [Math.abs(of)]
  } else {
    return []
  }
}
