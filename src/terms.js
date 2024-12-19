import * as API from './api.js'
import * as Variable from './variable.js'
import * as Bytes from './bytes.js'
import * as Link from './link.js'
import * as Constant from './constant.js'

/**
 * @param {API.Terms|API.Term[]|undefined} source
 * @returns {Iterable<API.Variable>}
 */
export function* variables(source) {
  if (source == null) {
    return
  } else if (Variable.is(source)) {
    yield source
  } else if (Array.isArray(source)) {
    if (!Bytes.is(source)) {
      for (const term of source) {
        if (Variable.is(term)) {
          yield term
        }
      }
    }
  } else if (!Link.is(source)) {
    for (const term of Object.values(source)) {
      if (Variable.is(term)) {
        yield term
      }
    }
  }
}

/**
 *
 * @param {API.Terms|API.Term[]} terms
 * @param {API.Terms|API.Term[]} to
 * @returns {-1|0|1}
 */
export const compare = (terms, to) => {
  if (Variable.is(terms)) {
    return Variable.is(to) ? Variable.compare(terms, to) : 1
  } else if (Constant.is(terms)) {
    return Constant.is(to) ? Constant.compare(terms, to) : -1
  } else if (Array.isArray(terms)) {
    return Array.isArray(to) ? compareTuple(terms, to) : -1
  } else {
    return compareRecord(terms, /** @type {Record<string, API.Term>} */ (to))
  }
}

/**
 * @param {API.Term[]} terms
 * @param {API.Term[]} to
 * @returns {-1|0|1}
 */
const compareTuple = (terms, to) => {
  const delta = terms.length - to.length
  if (delta < 0) {
    return -1
  } else if (delta > 0) {
    return 1
  } else {
    for (const [index, term] of terms.entries()) {
      const order = compare(term, to[index])
      if (order !== 0) {
        return order
      }
    }
    return 0
  }
}

/**
 *
 * @param {Record<string, API.Term>} terms
 * @param {Record<string, API.Term>} to
 * @returns {-1|0|1}
 */
const compareRecord = (terms, to) => {
  const keys = Object.keys(terms).sort()
  const other = Object.keys(to).sort()
  const delta = keys.length - other.length
  if (delta < 0) {
    return -1
  } else if (delta > 0) {
    return 1
  } else {
    for (const key of keys) {
      const value = to[key]
      const order = value === undefined ? 1 : compare(terms[key], to[key])
      if (order !== 0) {
        return order
      }
    }
    return 0
  }
}

/**
 * @param {API.Terms|API.Term[]} terms
 * @returns {string}
 */
export const toDebugString = (terms) => {
  if (Variable.is(terms)) {
    return `${terms}`
  } else if (Constant.is(terms)) {
    return Constant.toDebugString(terms)
  } else if (Array.isArray(terms)) {
    return `[${terms.map(toDebugString).join(', ')}]`
  } else {
    return `{${Object.entries(terms)
      .map(([key, value]) => `${key}: ${toDebugString(value)}`)
      .join(', ')}}`
  }
}
