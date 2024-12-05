import * as API from './api.js'
import * as Variable from './variable.js'
import * as Constant from './constant.js'
import * as Bytes from './bytes.js'

/**
 * @template {API.Variables} Match
 * @param {{[K in keyof Match]: Match[K] extends API.Variable<infer T> ? API.Term<T> : Match[K]}} input
 * @param {API.Rule<Match>} [rule]
 * @returns {API.Clause}
 */
export const match = (input, rule) => ({
  Rule: { match: input, rule },
})

/**
 * @template {API.Variables} Match
 *
 * @param {object} source
 * @param {Match} source.match
 * @param {API.Clause[]} [source.when]
 */
export const rule = ({ match, when = [] }) =>
  new Rule({
    match: match,
    when: { And: when },
  })

/**
 * @template {API.Variables} Match
 */
export class Rule {
  /**
   * @param {object} source
   * @param {Match} source.match
   * @param {API.Clause} source.when
   */
  constructor(source) {
    this.source = source
  }

  /**
   *
   * @param {{[K in keyof Match]: Match[K] extends API.Variable<infer T> ? API.Term<T> : Match[K]}} match
   * @returns {API.Clause}
   */
  match(match) {
    return {
      Rule: { match, rule: this.source },
    }
  }
}

/**
 * @param {API.Rule} rule
 */
export const setup = (rule) => {
  /** @type {Record<string, API.Variable>} */
  const table = {}
  const match = renameSelectorVariables(rule.match, table)
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
      Variable.is(member)
        ? renameVariable(member, table)
        : Constant.is(member)
          ? member
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
          Variable.is(member)
            ? renameVariable(member, table)
            : Constant.is(member)
              ? member
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
        match: renameSelectorVariables(clause.Rule.match, table),
        // If rule is omitted it is a recursive rule
        rule: clause.Rule.rule ?? rule,
      },
    }
  } else if (clause.Match) {
    const [from, relation, to] = clause.Match
    return /**  @type {API.Clause} */ ({
      Match:
        to === undefined
          ? [rename(from, table), relation]
          : [rename(from, table), relation, rename(to, table)],
    })
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
