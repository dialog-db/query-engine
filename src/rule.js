import * as API from './api.js'
import * as Variable from './variable.js'
import * as Constant from './constant.js'
import $ from './scope.js'

/**
 *
 * @param {API.Rule} source
 */
export const from = (source) =>
  source instanceof Rule ? source : (
    new Rule({ case: source.case, when: source.when.And ?? [source.when] })
  )

/**
 * @template {API.Row} Match
 * @param {Match} match
 * @returns {API.Clause}
 */
export const match = (match) => ({
  Rule: {
    match,
    rule: new Recursion(),
  },
})

/**
 * @template {API.RuleRow} [Match=API.RuleRow]
 * @typedef {(this: Rule<Match>, context: {rule: Rule<Match>}) => Iterable<API.Clause>} WhenBuilder
 */

/**
 * @template {API.RuleRow} [Match=API.RuleRow]
 *
 * @param {object} source
 * @param {Match} source.case
 * @param {API.Clause[] | WhenBuilder<Match>} [source.when]
 * @returns {Rule<Match>}
 */
export const rule = ({ case: match, when = [] }) =>
  new Rule({
    case: { this: $, ...match },
    when,
  })

/**
 * @template {API.RuleRow} Match
 */
class Rule {
  #when
  /**
   * @param {object} source
   * @param {Match} source.case
   * @param {API.Clause[] | WhenBuilder<Match>} source.when
   */
  constructor({ case: match, when }) {
    this.case = match

    this.#when = {
      And:
        typeof when === 'function' ?
          [...when.call(this, { rule: this })]
        : when.map(this.toClause, this),
    }
  }
  /**
   * @param {API.Clause} clause
   * @returns {API.Clause}
   */
  toClause(clause) {
    if (clause.Rule) {
      const { match, rule } = clause.Rule
      return {
        Rule: {
          match,
          rule:
            rule instanceof Recursion ? this
            : rule instanceof Rule ? rule
            : rule === undefined ? this
            : from(rule),
        },
      }
    } else if (clause.And) {
      return {
        And: clause.And.map(this.toClause, this),
      }
    } else if (clause.Or) {
      return {
        Or: clause.Or.map(this.toClause, this),
      }
    } else if (clause.Not) {
      return {
        Not: this.toClause(clause.Not),
      }
    } else {
      return clause
    }
  }
  /** @type {API.Clause} */
  get when() {
    return this.#when
  }

  /**
   * @param {API.InferRuleMatch<Match> & { this?: API.Term }} terms
   * @returns {{ Rule: API.RuleApplication<Match> }}
   */
  match(terms) {
    return {
      Rule: { match: /** @type {Match} */ (terms), rule: this },
    }
  }
}

/**
 * @implements {API.Rule}
 */
class Recursion {
  get case() {
    return this.throw()
  }
  get when() {
    return this.throw()
  }

  /**
   * @returns {never}
   */
  throw() {
    throw new TypeError(`Recursion should have been resolved`)
  }
}
/**
 * Setup substitutes all the variables in the rule with a unique ones. The
 * reason for this is to prevent the variables for different rule
 * applications from becoming confused with each other. For instance, if two
 * rules both use a variable `$.x`, then each one may add a binding for
 * `$.x` to the frame when it is applied. These two `$.x`'s have nothing to
 * do with each other, and should not be unified under assumption that two
 * must be consistent.
 *
 * @param {API.Rule} rule
 */
export const setup = (rule) => {
  /** @type {Record<string, API.Variable>} */
  const table = {}
  const match = rename(rule.case, table)
  const when = renameClauseVariables(rule.when, table, rule)
  return { match, when }
}

/**
 * @param {API.Selector} selector
 * @param {Record<string, API.Variable>} table
 * @returns {API.Selector}
 */
const renameSelectorVariables = (selector, table) =>
  Object.fromEntries(
    Object.entries(selector).map(([key, member]) => [
      key,
      Variable.is(member) ? renameVariable(member, table)
      : Constant.is(member) ? member
      : renameSelectorVariables(member, table),
    ])
  )

/**
 * @template {API.Terms|API.Term[]} Terms
 * @param {Terms} source
 * @param {Record<string, API.Variable>} table
 * @returns {Terms}
 */
const rename = (source, table) => {
  if (Variable.is(source)) {
    return renameVariable(source, table)
  } else if (Constant.is(source)) {
    return source
  } else if (Array.isArray(source)) {
    return /** @type {Terms} */ (source.map(($) => rename($, table)))
  } else if (source && typeof source === 'object') {
    return /** @type {Terms} */ (
      Object.fromEntries(
        Object.entries(source).map(([key, member]) => [
          key,
          Variable.is(member) ? renameVariable(member, table)
          : Constant.is(member) ? member
          : rename(member, table),
        ])
      )
    )
  } else {
    throw new TypeError(`Unexpected input type ${source}`)
  }
}

/**
 * @param {API.Clause} clause
 * @param {Record<string, API.Variable>} table
 * @param {API.Rule} rule
 * @returns {API.Clause}
 */
export const renameClauseVariables = (clause, table, rule) => {
  if (clause.And) {
    return { And: clause.And.map(($) => renameClauseVariables($, table, rule)) }
  } else if (clause.Or) {
    return { Or: clause.Or.map(($) => renameClauseVariables($, table, rule)) }
  } else if (clause.Not) {
    return { Not: renameClauseVariables(clause.Not, table, rule) }
  } else if (clause.Case) {
    const [entity, attribute, value] = clause.Case
    return {
      Case: [
        renameTermVariable(entity, table),
        renameTermVariable(attribute, table),
        renameTermVariable(value, table),
      ],
    }
  } else if (clause.Rule) {
    return {
      Rule: {
        match: rename(clause.Rule.match, table),
        // If rule is omitted it is a recursive rule
        rule: clause.Rule.rule ?? rule,
      },
    }
  } else if (clause.Match) {
    const [from, relation, to] = clause.Match
    return /**  @type {API.Clause} */ ({
      Match:
        to === undefined ?
          [rename(from, table), relation]
        : [rename(from, table), relation, rename(to, table)],
    })
  } else if (clause.Is) {
    const [actual, expect] = clause.Is
    return {
      Is: [
        renameTermVariable(actual, table),
        renameTermVariable(expect, table),
      ],
    }
  } else {
    throw new Error(`Unknown clause: ${clause}`)
  }
}

/**
 * @template T
 * @param {T} term
 * @param {Record<string, API.Variable>} table
 * @returns {T}
 */
const renameTermVariable = (term, table) =>
  Variable.is(term) ? renameVariable(term, table) : term

/**
 * @template {API.Variable} T
 * @param {T} variable
 * @param {Record<string, API.Variable>} table
 * @returns {T}
 */
const renameVariable = (variable, table) => {
  const id = Variable.id(variable)
  const type = Variable.toType(variable)
  if (table[id] == null) {
    table[id] = Variable.variable(type)
  }
  return /** @type {T} */ (table[id])
}
