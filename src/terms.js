import * as API from './api.js'
import * as Variable from './variable.js'
import * as Bytes from './data/bytes.js'
import * as Link from './data/link.js'
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
 * @param {API.Terms|API.Term[]} terms
 * @returns {string}
 */
export const toDebugString = (terms) => {
  if (Variable.is(terms)) {
    return Variable.toDebugString(terms)
  } else if (Constant.is(terms)) {
    return Constant.toDebugString(terms)
  } else if (Array.isArray(terms)) {
    const chunks = terms.map(toDebugString)
    const line = `[${chunks.join(', ')}]`
    if (line.length < 80) {
      return line
    } else {
      return `[\n  ${chunks.join(',\n  ')}\n]`
    }
  } else {
    const chunks = Object.entries(terms).map(
      ([key, value]) => `${toKey(key)}: ${toDebugString(value)}`
    )

    const line = `{ ${chunks.join(', ')} }`
    if (line.length < 80) {
      return line
    } else {
      return `{\n  ${chunks.join(',\n  ')}\n}`
    }
  }
}

/**
 * @param {API.Terms|API.Term[]} terms
 * @returns {API.Scalar|object}
 */
export const toJSON = (terms) => {
  if (Variable.is(terms)) {
    return Variable.toJSON(terms)
  } else if (Constant.is(terms)) {
    return Constant.toJSON(terms)
  } else if (Array.isArray(terms)) {
    return terms.map(toJSON)
  } else {
    return Object.fromEntries(
      Object.entries(terms).map(([key, value]) => [key, toJSON(value)])
    )
  }
}

/**
 * @param {string} key
 */
const toKey = (key) => (/^[a-zA-Z_]\w*$/.test(key) ? key : JSON.stringify(key))
