import * as API from './api.js'
import * as Variable from './variable.js'
import * as Bytes from './bytes.js'
import * as Link from './link.js'

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
