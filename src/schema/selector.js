import * as API from '../api.js'
import * as Term from '../term.js'
import * as Variable from '../variable.js'
import * as Constant from '../constant.js'
import $ from '../$.js'

/**
 * @param {unknown} terms
 * @returns {Iterable<[string, API.Term]>}
 */
export function* iterateTerms(terms, prefix = '') {
  if (terms) {
    for (const [key, term] of Object.entries(terms)) {
      if (Term.is(term)) {
        const path = prefix === '' ? key : `${prefix}.${key}`
        yield [path, term]
      } else {
        yield* iterateTerms(term, prefix === '' ? key : `${prefix}.${key}`)
      }
    }
  }
}

/**
 * @template {API.SchemaTerms} Terms
 * @param {Terms} source
 * @returns {Terms}
 */
export const namespaceTerms = (source) => namespaceTermsWithPrefix(source, '')

/**
 * @template {API.SchemaTerms} Terms
 * @param {Terms} source
 * @param {string} prefix
 * @returns {Terms}
 */
const namespaceTermsWithPrefix = (source, prefix) => {
  const terms = /** @type {API.SchemaTerms} */ ({})
  for (const [key, term] of Object.entries(source)) {
    if (Variable.is(term)) {
      terms[key] = $[`${prefix}${key}`]
    } else if (Constant.is(term)) {
      terms[key] = term
    } else {
      terms[key] = namespaceTermsWithPrefix(term, `${prefix}${key}.`)
    }
  }

  return /** @type {Terms} */ (terms)
}

/**
 * @template {API.SchemaTerms} Terms
 * @param {Terms} source
 * @returns {Record<string, API.Variable>}
 */
export const deriveMatch = (source) => {
  /** @type {Record<string, API.Variable>} */
  const match = {}
  for (const [key, term] of iterateTerms(source)) {
    if (Variable.is(term)) {
      match[key] = term
    }
  }

  return match
}
