import * as API from './api.js'
import * as Variable from './variable.js'
import * as Constant from './constant.js'

/**
 * @template {API.Variables} Match
 * @param {{[K in keyof Match]: Match[K] extends API.Variable<infer T> ? API.Term<T> : Match[K]}} input
 * @param {API.Rule<Match>} [rule]
 * @returns {API.Clause}
 */
export const match = (input, rule) => ({
  Rule: { input, rule },
})

/**
 * @template {API.Variables} Match
 *
 * @param {object} source
 * @param {Match} source.select
 * @param {API.Clause[]} [source.where]
 */
export const rule = ({ select, where = [] }) =>
  new Rule({
    select,
    where: { And: where },
  })

/**
 * @template {API.Variables} Match
 */
export class Rule {
  /**
   * @param {object} source
   * @param {Match} source.select
   * @param {API.Clause} source.where
   */
  constructor(source) {
    this.source = source
  }

  get select() {
    return this.source.select
  }
  get where() {
    return this.source.where
  }

  /**
   *
   * @param {{[K in keyof Match]: Match[K] extends API.Variable<infer T> ? API.Term<T> : Match[K]}} input
   * @returns {API.Clause}
   */
  match(input) {
    return {
      Rule: { input, rule: this.source },
    }
  }
}

/**
 * @param {API.Rule} rule
 */
export const setup = (rule) => renameVariablesIn(rule, {})

/**
 *
 * @param {API.Rule} rule
 * @param {Record<string, API.Variable>} table
 */
const renameVariablesIn = (rule, table = {}) => {
  const match = renameSelectorVariables(rule.select, table)
  const where = renameClauseVariables(rule.where, table, rule)
  return { match, where }
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
 *
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
  } else if (clause.Form) {
    return {
      Form: {
        selector: renameSelectorVariables(clause.Form.selector, table),
        confirm: clause.Form.confirm,
      },
    }
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
        input: renameSelectorVariables(clause.Rule.input, table),
        // If rule is omitted it is a recursive rule
        rule: clause.Rule.rule ?? rule,
      },
    }
  } else {
    return clause
  }
}

/**
 * @template {API.Term} T
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

/**
 * @param {API.Rule} rule
 */
export const conclusion = (rule) => rule.select

/**
 * @param {API.Rule} rule
 */
export const body = (rule) => rule.where

/**
 * @param {API.MatchRule} rule
 */
export const analyze = (rule) => {
  throw new Error('Not implemented')
}
