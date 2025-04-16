import * as Pattern from '../data/string/pattern.js'

/**
 * @param {object} input
 * @param {string} input.text
 * @param {string} input.pattern
 * @returns {string[]}
 */
export const like = ({ text, pattern }) => {
  if (typeof text === 'string' && typeof pattern === 'string') {
    if (Pattern.compile(pattern, Pattern.GLOB).test(text)) {
      return [text]
    } else {
      return []
    }
  } else {
    return []
  }
}

/**
 * @param {object} source
 * @param {string} source.of
 * @param {string} source.with
 */
export const concat = ({ of, with: suffix }) => {
  if (typeof of === 'string' && typeof suffix === 'string') {
    return [`${of}${suffix}`]
  } else {
    return []
  }
}

/**
 * @param {string} of
 */
export const words = (of) => {
  if (typeof of === 'string') {
    return of.split(/\s+/)
  } else {
    return []
  }
}

/**
 * @param {string} of
 */
export const lines = (of) => {
  if (typeof of === 'string') {
    return of.split(/\r\n|\r|\n/g)
  } else {
    return []
  }
}

/**
 * @param {string} of
 */
export const toUpperCase = (of) => {
  if (typeof of === 'string') {
    return [of.toUpperCase()]
  } else {
    return []
  }
}

/**
 /**
 * @param {string} of
 */
export const toLowerCase = (of) => {
  if (typeof of === 'string') {
    return [of.toLowerCase()]
  } else {
    return []
  }
}

/**
 * @param {string} of
 */
export const trim = (of) => {
  if (typeof of === 'string') {
    return [of.trim()]
  } else {
    return []
  }
}

/**
 * @param {string} of
 */
export const trimStart = (of) => {
  if (typeof of === 'string') {
    return [of.trimStart()]
  } else {
    return []
  }
}

/**
 * @param {string} of
 */
export const trimEnd = (of) => {
  if (typeof of === 'string') {
    return [of.trimEnd()]
  } else {
    return []
  }
}

/**
 * @param {string} value
 */
export const length = (value) => {
  if (typeof value === 'string') {
    return [value.length]
  } else {
    return []
  }
}

/**
 * @param {object} input
 * @param {string} input.this
 * @param {string} input.slice
 * @returns {true[]}
 */
export const includes = ({ this: text, slice }) => {
  if (text.includes(slice)) {
    return [true]
  } else {
    return []
  }
}

/**
 * @param {object} input
 * @param {string} input.of
 * @param {string} input.start
 * @param {string} input.end
 */
export const slice = ({ of, start, end }) => {
  if (typeof start === 'number' && typeof end === 'number') {
    return [of.slice(start, end)]
  } else {
    return []
  }
}
