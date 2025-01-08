import * as API from './api.js'
import { Link } from './constant.js'
import * as Term from './term.js'
import * as Bindings from './bindings.js'
import * as Data from './formula/data.js'
import * as Text from './formula/text.js'
import * as Math from './formula/math.js'
import * as UTF8 from './formula/utf8.js'
import * as Terms from './terms.js'

/**
 * @param {API.Querier} db
 * @param {API.Clause['Match'] & {}} formula
 * @param {Iterable<API.Bindings>} frames
 */
export const evaluate = function* (db, [from, relation, to], frames) {
  const operator =
    /** @type {(input: API.Operand) => Iterable<API.Operand>} */
    (typeof relation === 'string' ? operators[relation] : relation)

  const matches = []
  for (const frame of frames) {
    const input = resolve(/** @type {API.Terms} */ (from), frame)
    for (const out of operator(input)) {
      if (to == null) {
        matches.push(frame)
      } else if (Term.is(to)) {
        const match = Term.unify(/** @type {API.Term} */ (out), to, frame)
        if (!match.error) {
          matches.push(match.ok)
        }
      } else {
        const extension = /** @type {Record<string, API.Scalar>} */ (out)
        let bindings = frame
        for (const [key, term] of Object.entries(to)) {
          const match = Term.unify(extension[key], term, frame)
          if (match.ok) {
            bindings = match.ok
          } else {
            break
          }
        }
        matches.push(bindings)
      }
    }
  }
  return matches
}

/**
 * @template {API.Terms} Terms
 * @param {Terms} terms
 * @param {API.Bindings} bindings
 * @returns {API.InferTerms<Terms>}
 */
export const resolve = (terms, bindings) =>
  /** @type {API.InferTerms<Terms>} */
  (
    Term.is(terms) ? Bindings.get(bindings, terms)
    : Array.isArray(terms) ? terms.map((term) => Bindings.get(bindings, term))
    : Object.fromEntries(
        Object.entries(terms).map(([key, term]) => [
          key,
          Bindings.get(bindings, term),
        ])
      )
  )

/**
 * @param {API.Scalar} value
 * @returns {[API.Link]}
 */
export const reference = (value) => [Link.of(value)]

export const operators = {
  '==': Data.is,
  '>': Data.greater,
  '<': Data.less,
  '>=': Data.greaterOrEqual,
  '<=': Data.lessOrEqual,
  'data/type': Data.type,
  'data/refer': Data.refer,
  'text/like': Text.like,
  'text/concat': Text.concat,
  'text/words': Text.words,
  'text/lines': Text.lines,
  'text/case/upper': Text.toUpperCase,
  'text/case/lower': Text.toLowerCase,
  'text/trim': Text.trim,
  'text/trim/start': Text.trimStart,
  'text/trim/end': Text.trimEnd,
  'text/includes': Text.includes,
  'text/slice': Text.slice,
  'text/length': Text.length,
  'text/to/utf8': UTF8.toUTF8,
  'utf8/to/text': UTF8.fromUTF8,
  '+': Math.addition,
  '-': Math.subtraction,
  '*': Math.multiplication,
  '/': Math.division,
  '%': Math.modulo,
  '**': Math.power,
  'math/absolute': Math.absolute,
}

export const formulas = {
  '==': {
    formula: Data.is,
    in: {
      is: {},
    },
    out: {
      this: {},
    },
  },
  '>': {
    formula: Data.greater,
    in: {
      this: {},
      than: {},
    },
    out: {
      is: { type: 'boolean' },
    },
  },
  '<': {
    formula: Data.less,
    in: {
      this: {},
      than: {},
    },
    out: {
      is: { type: 'boolean' },
    },
  },
  '<=': {
    formula: Data.less,
    in: {
      this: {},
      than: {},
    },
    out: {
      is: { type: 'boolean' },
    },
  },
  '>=': {
    formula: Data.less,
    of: {
      this: {},
      than: {},
    },
    is: { type: 'boolean' },
  },
  'data/type': {
    formulas: Data.type,
    of: {},
    is: {},
  },
  'data/reference': {
    formula: Data.refer,
    in: { of: {} },
    out: { is: {} },
  },
  'text/like': {
    formula: Text.like,
    in: { text: { type: 'string' }, pattern: { type: 'string' } },
    out: { is: { type: 'string' } },
  },
  'text/concat': {
    formula: Text.concat,
    in: {
      of: { type: 'string' },
      with: { type: 'string' },
    },
    out: { is: { type: 'string' } },
  },
  'text/words': {
    formula: Text.words,
    in: { of: { type: 'string' } },
    out: { is: { type: 'string' } },
  },
  'text/lines': {
    formula: Text.lines,
    in: { of: { type: 'string' } },
    out: { is: { type: 'string' } },
  },
  'text/case/upper': {
    formula: Text.toUpperCase,
    in: { of: { type: 'string' } },
    out: { is: { type: 'string' } },
  },
  'text/case/lower': {
    formula: Text.toLowerCase,
    in: { of: { type: 'string' } },
    out: { is: { type: 'string' } },
  },
  'text/trim': {
    formula: Text.trim,
    in: { of: { type: 'string' } },
    out: { is: { type: 'string' } },
  },
  'text/trim/start': {
    formula: Text.trimStart,
    in: { of: { type: 'string' } },
    out: { is: { type: 'string' } },
  },
  'text/trim/end': {
    formula: Text.trimEnd,
    in: { of: { type: 'string' } },
    out: { is: { type: 'string' } },
  },
  'text/includes': {
    formula: Text.includes,
    in: { text: { type: 'string' }, slice: { type: 'string' } },
    out: { is: { type: 'boolean' } },
  },
  'text/slice': {
    formula: Text.slice,
    in: {
      of: { type: 'string' },
      start: { type: 'number' },
      end: { type: 'number' },
    },
    out: { is: { type: 'string' } },
  },
}

/**
 * Iterates over the variables in the given relation.
 *
 * @param {API.Clause['Match'] & {}} relation
 * @returns {Iterable<API.Variable>}
 */
export const variables = function* ([from, _relation, to]) {
  yield* Terms.variables(from)
  yield* Terms.variables(to)
}

/**
 * Estimates cost and analyzes variables for Match clauses based on the correct Formula structure
 *
 * @param {API.Formula} formula
 */
export const analyze = (formula) => {
  /** @type {Set<API.VariableID>} */
  const dependencies = new Set()
  /** @type {Set<API.VariableID>} */
  const binds = new Set()

  const [from, _relation, to] = formula

  // Collect variables from input terms as dependencies

  for (const variable of Terms.variables(from)) {
    dependencies.add(variable['?'].id)
  }

  // Collect variables from output terms as binds
  for (const variable of Terms.variables(to)) {
    binds.add(variable['?'].id)
  }

  // Match clauses are relatively cheap if dependencies are met
  return {
    dependencies,
    binds,
    cost: 10,
  }
}
