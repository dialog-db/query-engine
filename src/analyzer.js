import * as API from './api.js'
import * as Variable from './variable.js'
import * as Terms from './terms.js'
import * as Term from './term.js'
import { Link } from './constant.js'
import $, { variable } from './$.js'
import * as Constant from './constant.js'
import { operators } from './formula.js'
import { add } from './selector.js'
import { indent, li } from './format.js'
import * as Task from './task.js'
import { _ } from './$.js'
import * as Scope from './scope.js'
import * as Cursor from './cursor.js'

export { $ }

/**
 * @param {API.Select} selector
 */
export const select = (selector) => Select.from({ match: selector })

/**
 * @template {API.Conclusion} Match
 * @param {API.Deduction<Match>} source
 */
export const rule = (source) => DeductiveRule.from(source)

/**
 * @template {API.SystemOperator['operator']} Operator
 * @param {Operator} operator
 * @returns {Formula<API.SystemOperator & {operator: Operator}>}
 */
export const formula = (operator) =>
  /** @type {Formula<API.SystemOperator & {operator: Operator}>} */ (
    new Formula(/** @type {never} */ (operator))
  )

/**
 * @param {API.Conjunct|API.Recur} source
 */
export const from = (source) => {
  if (source.not) {
    return Negation.from(source)
  } else if (source.rule) {
    return RuleApplication.from(source)
  } else if (source.operator) {
    return FormulaApplication.from(source)
  } else if (source.recur) {
    return RuleRecursion.from(source)
  } else {
    return Select.from(source)
  }
}

/**
 * @implements {API.MatchFact}
 */
class Select {
  /**
   * @param {API.MatchFact} source
   */
  static from({ match }) {
    const { of, the, is } = match
    const cells = new Map()
    const select = new this(match, cells)

    // Entity is variable
    if (Variable.is(of)) {
      cells.set(of, 500)
    }

    // Attribute is a variable
    if (Variable.is(the)) {
      cells.set(the, 200)
    }

    // Value is a variable
    if (Variable.is(is)) {
      cells.set(is, 300)
    }

    return select
  }
  /**
   * @param {API.Select} selector
   * @param {Map<API.Variable, number>} cells
   */
  constructor(selector, cells) {
    this.cells = cells
    this.selector = selector
  }

  get recurs() {
    return null
  }

  get match() {
    return this.selector
  }

  /**
   * Base execution cost of the select operation.
   */
  get cost() {
    return 100
  }
  /**
   *
   * @param {API.Scope} scope
   */
  plan({ references, bindings }) {
    return new SelectPlan(this, references, bindings)
  }

  toJSON() {
    return {
      match: this.selector,
    }
  }

  toDebugString() {
    const { of, the, is } = this.selector
    const parts = []
    if (the !== undefined) {
      parts.push(`the: ${Term.toDebugString(the)}`)
    }

    if (of !== undefined) {
      parts.push(`of: ${Term.toDebugString(of)}`)
    }

    if (is !== undefined) {
      parts.push(`is: ${Term.toDebugString(is)}`)
    }

    return `{ match: { ${parts.join(', ')} } }`
  }
}

export class SelectPlan {
  /**
   * @param {Select} source
   * @param {API.Cursor} cursor
   * @param {API.MatchFrame} parameters
   */
  constructor(source, cursor, parameters) {
    this.source = source
    this.cursor = cursor
    this.parameters = parameters
  }

  get selector() {
    return this.source.selector
  }

  get recurs() {
    return null
  }

  /**
   * @template {API.Scalar} T
   * @param {API.Term<T>|undefined} term
   * @param {API.MatchFrame} bindings
   * @returns {API.Term<T>|undefined}
   */
  resolve(term, bindings) {
    if (Variable.is(term)) {
      return Cursor.get(bindings, this.cursor, term) ?? term
      // const reference = Cursor.resolve(this.cursor, term)
      // return /** @type {API.Term<T>} */ (bindings.get(reference) ?? reference)
    } else {
      return term
    }
  }

  /**
   * @param {API.EvaluationContext} context
   */
  *evaluate({ source, selection }) {
    const matches = []
    const { selector, parameters, cursor } = this
    for (const bindings of selection) {
      const the = this.resolve(selector.the, bindings)
      const of = this.resolve(selector.of, bindings)
      const is = this.resolve(selector.is, bindings)

      // Note: We expect that there will be LRUCache wrapping the db
      // so calling scan over and over again will not actually cause new scans.
      /** @type {API.FactsSelector} */
      const query = {}
      if (!Variable.is(of)) {
        query.entity = of
      }
      if (!Variable.is(the)) {
        query.attribute = the
      }
      if (!Variable.is(is)) {
        query.value = is
      }

      const facts = yield* source.scan(query)

      for (const [entity, attribute, value] of facts) {
        try {
          const match = new Map(bindings)

          if (Variable.is(the)) {
            Cursor.set(match, cursor, the, attribute)
          }

          if (Variable.is(of)) {
            Cursor.set(match, cursor, of, entity)
          }

          if (Variable.is(is)) {
            Cursor.set(match, cursor, is, value)
          }

          matches.push(match)
        } catch {}
      }
    }

    return matches
  }

  toJSON() {
    return this.source.toJSON()
  }

  toDebugString() {
    return this.source.toDebugString()
  }
}

/**
 * @template {API.SystemOperator} Operator
 */
class Formula {
  /**
   *
   * @param {Operator['operator']} operator
   */
  constructor(operator) {
    this.operator = operator
  }
  /**
   * @param {Operator['match']} terms
   */
  apply(terms) {
    return FormulaApplication.from(
      /** @type {Operator} */ ({
        operator: this.operator,
        match: terms,
      })
    )
  }
}

class FormulaApplication {
  /**
   * @param {API.SystemOperator} source
   */
  static from(source) {
    const { match } = source

    const { of, is, ...rest } =
      /** @type {{is?: API.Term, of?: API.Term[]|API.Term}} */ (match)

    const from =
      Object.keys(rest).length > 0 ?
        /** @type {Record<string, API.Term>} */ ({ ...rest, of })
      : /** @type {API.Term} */ (of)

    /** @type {Record<string, API.Term>} */
    const to = is ? { is } : {}

    const cells = new Map()
    const application = new this(source, cells, from, to)

    for (const variable of Terms.variables(from)) {
      // Cost of omitting an input variable is Infinity meaning that we can not
      // execute the operation without binding the variable.
      cells.set(variable, Infinity)
    }

    for (const variable of Terms.variables(to)) {
      if (cells.has(variable)) {
        throw new ReferenceError(
          `Variable ${variable} cannot appear in both input and output of Match clause`
        )
      }

      // Cost of omitting an output variable is 0 meaning that we can execute
      // the operation without binding the variable.
      cells.set(variable, 0)
    }

    return application
  }

  /**
   * @param {API.SystemOperator} source
   * @param {Map<API.Variable, number>} cells
   * @param {Record<string, API.Term>|API.Term} from
   * @param {Record<string, API.Term>} to
   */
  constructor(source, cells, from, to) {
    this.cells = cells
    this.source = source
    this.from = from
    this.to = to
  }

  get match() {
    return this.source.match
  }
  get operator() {
    return this.source.operator
  }

  get recurs() {
    return null
  }

  /**
   * Base execution cost of the formula application operation.
   */
  get cost() {
    return 5
  }

  /**
   * @param {API.Scope} scope
   */
  plan(scope) {
    return new FormulaApplicationPlan(
      this.source,
      this.cells,
      this.from,
      this.to,
      scope.references,
      scope.bindings
    )
  }

  toJSON() {
    return {
      match: this.source.match,
      operator: this.source.operator,
    }
  }

  toDebugString() {
    const { match, operator } = this.source

    return `{ match: ${Terms.toDebugString(match)}, operator: "${operator}" }`
  }

  /**
   * @param {FormulaApplication} other
   */
  compare({ source: to }) {
    const { match, operator } = this.source
    let order = Terms.compare(match, to.match)
    if (order !== 0) {
      return order
    }

    return Constant.compare(operator, to.operator)
  }
}

class FormulaApplicationPlan {
  /**
   * @param {API.SystemOperator} source
   * @param {Map<API.Variable, number>} cells
   * @param {Record<string, API.Term>|API.Term} from
   * @param {Record<string, API.Term>} to
   * @param {API.Cursor} cursor
   * @param {API.MatchFrame} parameters
   */
  constructor(source, cells, from, to, cursor, parameters) {
    this.cells = cells
    this.source = source
    this.from = from
    this.to = to
    this.cursor = cursor
    this.parameters = parameters
  }

  get recurs() {
    return null
  }

  // /**
  //  * Base execution cost of the formula application operation.
  //  */
  // get cost() {
  //   return 5
  // }

  /**
   * @template {API.Terms} Terms
   * @param {Terms} terms
   * @param {API.MatchFrame} bindings
   * @returns {API.InferTerms<Terms>}
   */
  resolve(terms, bindings) {
    return /** @type {API.InferTerms<Terms>} */ (
      Term.is(terms) ? Cursor.get(bindings, this.cursor, terms)
      : Array.isArray(terms) ?
        terms.map((term) => Cursor.get(bindings, this.cursor, term))
      : Object.fromEntries(
          Object.entries(terms).map(([key, term]) => [
            key,
            Cursor.get(bindings, this.cursor, term),
          ])
        )
    )
  }

  /**
   * @param {API.EvaluationContext} context
   */
  *evaluate(context) {
    const { from, to, source } = this
    const operator =
      /** @type {(input: API.Operand) => Iterable<API.Operand>} */
      (source.formula ?? operators[this.source.operator])

    const matches = []
    for (const frame of context.selection) {
      const input = this.resolve(from, frame)
      for (const output of operator(input)) {
        // If function returns single output we treat it as { is: output }
        // because is will be a cell in the formula application.
        const out = Constant.is(output) ? { is: output } : output
        const cells = Object.entries(to)
        if (cells.length === 0) {
          matches.push(frame)
        } else {
          const match = cells.length > 0 ? new Map(frame) : frame
          const extension = /** @type {Record<string, API.Scalar>} */ (out)
          try {
            for (const [key, cell] of cells) {
              Cursor.merge(match, this.cursor, cell, extension[key])
            }
            matches.push(match)
          } catch {}
        }
      }
    }

    return matches
  }

  toJSON() {
    return {
      match: this.source.match,
      operator: this.source.operator,
    }
  }

  toDebugString() {
    const { match, operator } = this.source

    return `{ match: ${Terms.toDebugString(match)}, operator: "${operator}" }`
  }
}

/**
 * @template {API.Conclusion} [Match=API.Conclusion]
 * @implements {API.MatchRule<Match>}
 */
export class RuleApplication {
  /**
   * @template {API.Conclusion} [Match=API.Conclusion]
   * @param {API.MatchRule<Match>} source
   * @returns {RuleApplication<Match>}
   */
  static from(source) {
    // Build the underlying rule first
    const rule = DeductiveRule.from(source.rule)

    return this.new(rule, source.match)
  }

  /**
   * Creates a rule application with a given `rule` and set of `terms`.
   *
   * @template {API.Conclusion} Match
   * @param {DeductiveRule<Match>} rule
   * @param {Partial<API.RuleBindings<Match>>} terms
   */
  static new(rule, terms) {
    /**
     * Create an application and populate `references`, `bindings` and `cells`
     * given the `terms`.
     */
    const application = new this(terms, rule)
    const { references, bindings, cells } = application

    /**
     * We go over the rule variables and first we create links to variables
     * in the application. If some of the terms are constants we will collect
     * them in parameters and go over them next to bind them. We need to do it
     * in two passes to handle a case like the one below
     *
     * ```ts
     * {
     *   match: { this: $.q, as: 2 }
     *   rule: {
     *     match: { this: $.a, as: $.a },
     *     when: {}
     *   }
     * }
     * ```
     *
     * Where we first want to create link `$.a -> $.q` and then create a
     * binding `$q = 2` so that we would end up with
     *
     * ```ts
     * bindings = new Map([[$.q, 2]])
     * references = new Map([[$.a, $.q]])
     * ```
     *
     * @type {Map<API.Variable, API.Scalar>}
     */
    const constants = new Map()
    for (const [at, variable] of Object.entries(rule.match)) {
      // First we get a term corresponding to this rule binding.
      const term = terms[at]
      // We get a base cost for it from the rule itself. If not listed by the
      // rule cost is `0` (which may happen if binding is not used by a rule
      // body).
      const cost = rule.cells.get(variable) ?? 0

      if (term === undefined && cost >= Infinity) {
        throw new ReferenceError(
          `Rule application omits required binding for "${at}"`
        )
      }

      // If binding term is a variable itself we combine costs. For example if
      // we had `{x, y}` rule variables both mapped to same `$.q` variable total
      // cost of `$.q` would be costs of `x` and `y` (inside rule body) combined.
      if (Variable.is(term)) {
        cells.set(term, combineCosts(cells.get(term) ?? 0, cost))

        /**
         * We also add a `variable → term` mapping to the `references` so that
         * during evalutaion we will know which variable to set.
         *
         * ⚠️ We override a variable (by passing `true` as a last argument) to
         * workaround the problematic case like the one below
         *
         * ```ts
         * {
         *    match: { x: $.a, y: $.b },
         *    rule: {
         *      match: { x: $.x, y: $.x }
         *    }
         * }
         * ```
         *
         * Here we will end up `$.x → $.a` and then with `$.x → $.b`. We do not
         * support `1:n` relation and we could either error which will break
         * above example or we workaround by drop first mapping.
         *
         * TODO: Implement support for `m:n` relations which can happen.
         */
        const fixme = Cursor.link(references, variable, term, true)
      }
      // Terms corresponding to rule binding that aren't used required may be
      // omitted.
      else if (term === undefined) {
        // However if binding is required if (cost == Infinity) in which case we
        // raise a reference error as such rule application can never be evaluated.
        // TODO: It may be worth deferring this to planning phase or more simply
        // require that all terms were provided regardless of the rule semantics.
        if ((rule.cells.get(variable) ?? 0) >= Infinity) {
          throw new ReferenceError(
            `Rule application omits required binding for "${at}"`
          )
        }
      }
      // Otherwise we have a constant binding which we capture so it will be
      // set in bindings in the next loop.
      else {
        constants.set(variable, term)
      }
    }

    // Now go over the collected constants and assign them to the application
    // bindings.
    // ⚠️ Note that we need to do this after we have collected all the references
    // so that bindings set will be to the term variables as opposed to local
    // variables.
    for (const [variable, term] of constants) {
      Cursor.set(bindings, references, variable, term)
    }

    return application
  }
  /**
   * @param {Partial<API.RuleBindings<Match>> & {}} match
   * @param {DeductiveRule<Match>} rule
   * @param {API.Cursor} references
   * @param {API.MatchFrame} bindings
   * @param {Map<API.Variable, number>} cells
   */
  constructor(
    match,
    rule,
    references = new Map(),
    bindings = new Map(),
    cells = new Map()
  ) {
    this.match = match
    this.rule = rule
    /**
     * Mapping between variables inside the rule and variables that they were
     * bound to via rule application. Given below example we will have mapping
     * `$.name → $.q`.
     *
     * ```js
     * {
     *    match: { name: $.q },
     *    rule: {
     *      match: { name: $.name },
     *      when: {
     *        where: [{ match: { the: "person/name", is: $.name } }]
     *      }
     *    }
     * }
     * ```
     */
    this.references = references
    /**
     * Mapping between variables inside the rule and constants that they were
     * bound to via rule application. Given below example we will have a mapping
     * `$.name → "Irakli"`.
     *
     * ```js
     * {
     *    match: { name: "Irakli", address: $.q },
     *    rule: {
     *      match: { name: $.name, $.address },
     *      when: {
     *        where: [
     *          { match: { the: "person/name", of: $.person, is: $.name } },
     *          { match: { the: "person/address", of: $.person, is: $.address } }
     *        ]
     *      }
     *    }
     * }
     * ```
     */
    this.bindings = bindings

    /**
     * Mapping between variables that were bound in the application and the
     * cost estimate for them staying unbound.
     */
    this.cells = cells
  }

  get recurs() {
    return null
  }

  /**
   * Base cost of the rule application is the base cost of the rule itself.
   */
  get cost() {
    return this.rule.cost
  }

  /**
   * Plans the rule execution in the given scope. `RuleApplication` links rule
   * variables (`this.rule.match`) to the variables passed in an application
   * (`this.match`). However rule application itself may be nested inside some
   * rule where terms (`this.match`) gets linked in this planning phase.
   *
   * @param {API.Scope} scope
   */
  plan(scope) {
    // We start with fresh list of references where we will capture links from
    // the this application references to the references in in given scope.
    const references = new Map()
    // We copy bindings because those will remain the same. We do need to copy
    // because `.plan` can be called multiple times and based no scope passed
    // we may have to add some constants.
    const bindings = new Map(this.bindings)

    /**
     * Next we go over references in the rule application (`this.references`)
     * and remap those to variables in the provided scope (`{references, bindings}`).
     * To make it clear consider following example
     *
     * ```ts
     * {
     *    match: { name: $.q },
     *    rule: { name: $.name },
     *    when: {
     *      where: [
     *        {
     *          match: { firstName: $.name, lastName: $._ } },
     *          rule: {
     *            match: { firstName: $.firstName, lastName: $.lastName },
     *            when: {
     *              where: [
     *                 { the: "name/first", of: $.person, is: $.firstName },
     *                 { the: "name/last", of: $.person, is: $.lastName }
     *              ]
     *            }
     *          }
     *      ]
     *    }
     * ```
     *
     * In this case oure provided scope `references` will be `$.name → $.q`
     * while `this.references` will have `$.firstName → $.name`. What we want
     * to end up in `scope.references` is `$.firstName → $.q` allowing us to
     * can skip propagation during evaluation. To accomlish this we iterate over
     * `this.references` and then map from inner `$.firstName` to whatever the
     * outer `$.name` points in the provided `{references}` which happens to be
     * `$.q`.
     */
    for (const [inner, outer] of this.references) {
      for (const source of outer) {
        for (const variable of Cursor.resolve(scope.references, source)) {
          Cursor.link(references, inner, variable)

          // If there was a `variable` was alread bound to a constant in the scope
          // we want to retain it which is what we are doing below.
          const value = Cursor.get(scope.bindings, scope.references, variable)

          // If we variable was set in scope we copy it into a local bindings.
          if (value !== undefined) {
            Cursor.set(bindings, references, inner, value)
          }
        }
      }
    }

    return new RuleApplicationPlan(this.match, this.rule, references, bindings)
  }

  /**
   * Caches the application plan so that it can be reused across many queries.
   *
   * @type {RuleApplicationPlan<Match>|null}
   */
  #plan = null

  prepare() {
    let plan = this.#plan
    if (plan == null) {
      plan = this.plan(Scope.free)
      this.#plan = plan
    }
    return plan
  }

  /**
   * Runs this rule application as a query in on a given `input`.
   *
   * @param {object} input
   * @param {API.Querier} input.from
   */
  select(input) {
    return Task.perform(this.prepare().query(input))
  }

  toDebugString() {
    const { match, rule } = this
    return `{ match: ${Terms.toDebugString(
      /** @type {{}} */ (match)
    )}, rule: ${toDebugString(rule)} }`
  }
}

/**
 * Creates map of variables with identifiers as keys and corresponding variables
 * as values. Omits non variable terms
 *
 * @param {API.Conclusion} match
 * @returns {Map<string, API.Variable>}
 */
const ruleBindings = (match) => {
  const bindings = new Map()
  for (const [name, variable] of Object.entries(match)) {
    if (Variable.is(variable)) {
      bindings.set(name, variable)
    }
  }
  return bindings
}

/**
 * @template {API.Conclusion} [Match=API.Conclusion]
 * @implements {API.Deduction<Match>}
 */
export class DeductiveRule {
  /**
   * @template {API.Conclusion} Case
   * @param {API.Deduction<Case>} source
   */
  static from(source) {
    const disjuncts =
      Array.isArray(source.when) ? { where: source.when } : source.when ?? {}

    let cells = new Map()
    let recurs = false
    let total = 0
    /** @type {Record<string, Join>} */
    const when = {}
    const bindings = ruleBindings(source.match)
    const variables = new Set(bindings.values())

    const entries = Object.entries(disjuncts)
    for (const [name, conjuncts] of entries) {
      const deduction = Join.from({
        name,
        conjuncts,
        bindings,
        variables,
      })
      total += deduction.cost
      when[name] = deduction

      for (const [variable, cost] of deduction.cells) {
        const currentCost = cells.get(variable) ?? 0
        cells.set(variable, currentCost + cost)
      }

      if (deduction.recurs) {
        recurs = true
      }
    }

    // If no disjuncts, all match variables are required inputs as they
    // must unify by relation.
    if (entries.length === 0) {
      for (const variable of bindings.values()) {
        cells.set(variable, Infinity)
      }
    }

    return new this(source.match, cells, total, recurs, when)
  }

  /**
   * @param {Match} match - Pattern to match against
   * @param {Map<API.Variable, number>} cells - Cost per variable when not bound
   * @param {number} cost - Base execution cost
   * @param {boolean} recurs
   * @param {Record<string, Join>} when - Named deductive branches that must be evaluated
   */
  constructor(match, cells, cost, recurs, when) {
    this.match = match
    this.cells = cells
    this.cost = recurs ? cost ** 2 : cost
    this.recurs = recurs
    this.when = when
  }

  /**
   * @param {API.RuleBindings<Match>} terms
   * @returns {RuleApplication<Match>}
   */
  apply(terms = this.match) {
    return RuleApplication.new(this, terms)
  }

  /**
   * @param {API.Scope} application
   */
  plan(application) {
    /** @type {Record<string, JoinPlan>} */
    const when = {}
    let cost = 0
    const disjuncts = Object.entries(this.when)
    let recursive = 0
    for (const [name, disjunct] of disjuncts) {
      const plan = disjunct.plan(application)
      when[name] = plan
      cost += plan.cost
      if (disjunct.recurs) {
        recursive++
      }
    }

    // If we have no disjuncts there will be nothing raising problem if required
    // cell is not bound, which can happen in rules like this one
    // rule({ match: { this: $, as: $ } })
    // Which is why we need to perform validation here in such a case.
    if (disjuncts.length === 0) {
      for (const [cell, cost] of this.cells) {
        if (
          cost >= Infinity &&
          !Cursor.has(application.bindings, application.references, cell)
        ) {
          throw new ReferenceError(
            `Rule application requires binding for ${cell} variable`
          )
        }
      }

      // We also need to add some body so the that evaluation creates a result.
      when.where = new JoinPlan([], application.references, 0)
    }

    // If all branches are recursive raise an error because we need a base case
    // to terminate.
    if (recursive > 0 && recursive === disjuncts.length) {
      throw new SyntaxError(
        `Recursive rule must have at least one non-recursive branch`
      )
    }

    // If recursive rule we inflate the cost by factor
    cost = this.recurs ? cost ** 2 : cost

    return new DeductiveRulePlan(
      this.match,
      application,
      when,
      cost,
      this.recurs
    )
  }

  toDebugString() {
    const disjuncts = Object.entries(this.when)
    const when = []
    for (const [name, disjunct] of disjuncts) {
      when.push(`${name}: ${toDebugString(disjunct)}`)
    }
    const body = `when: { ${indent(when.join(',\n'))} }`

    return indent(`{
  match: ${Terms.toDebugString(this.match)},
  ${body}}
}`)
  }
}

/**
 * @template {API.Conclusion} [Match=API.Conclusion]
 */
class RuleRecursion {
  /**
   * @template {API.Conclusion} [Match=API.Conclusion]
   * @param {API.Recur<Match>} source
   */
  static from({ recur: terms }) {
    const cells = new Map()
    // All variables in the rule need to be in the cells
    for (const variable of Terms.variables(terms)) {
      cells.set(variable, 0)
    }

    return new this(terms, cells)
  }

  get recurs() {
    return this
  }

  /**
   * @param {Match} terms
   * @param {Map<API.Variable, number>} cells
   */
  constructor(terms, cells) {
    this.terms = terms
    this.cells = cells
  }

  get cost() {
    return Infinity
  }

  /**
   * @param {API.Scope} scope
   * @returns {API.EvaluationPlan}
   */
  plan(scope) {
    return this
  }

  toJSON() {
    return {
      recur: this.terms,
    }
  }

  toDebugString() {
    return indent(
      `{ recur: ${indent(
        Terms.toDebugString(/** @type {{}} */ (this.terms))
      )} }`
    )
  }

  /**
   * Instead of direct recursion, we collect bindings to be processed later
   * in a breadth-first fixed-point iteration.
   *
   * @param {API.EvaluationContext} context
   */
  *evaluate({ self, selection, recur }) {
    const to = self.match
    const from = this.terms

    // For each match in our current selection
    for (const match of selection) {
      // Map variables from the current context to the recursive rule's variables
      const bindings = new Map()
      for (const [name, term] of Object.entries(from)) {
        const value = match.get(term)
        const variable = to[name]
        if (value !== undefined && variable !== undefined) {
          Cursor.set(bindings, self.scope.references, variable, value)
        }
      }

      // // First, get all variables from original rule 'to' pattern
      // // This ensures we maintain all variable bindings that should be preserved
      // for (const key of Object.keys(to)) {
      //   const targetVar = to[key]
      //   if (match.has(targetVar)) {
      //     // Preserve the binding if it exists in current match
      //     terms.set(targetVar, match.get(targetVar))
      //   }
      // }

      // // Then, map variables from this recursive call's pattern
      // for (const [key, variable] of Object.entries(from)) {
      //   const value = match.get(variable)
      //   if (value !== undefined) {
      //     terms.set(to[key], value)
      //   }
      // }

      // We store pairs of [nextIterationBindings, originalContextBindings]
      // This allows us to combine results of recursive evaluation with the original context
      recur.push([bindings, new Map(match)])
    }

    // Recur doesn't directly return matches - it schedules them for later
    return []
  }
}

/**
 * Generate a unique identifier for a match frame
 * This is used for cycle detection in the fixed-point evaluation
 *
 * @param {API.MatchFrame} frame
 * @param {string} [context=''] - Optional context to differentiate matches in different evaluation contexts
 */
const identifyMatch = (frame, context = '') => {
  // A more reliable identifier that preserves the shape of objects
  const mappedEntries = [...frame]
    .map(([variable, value]) => {
      const varStr = variable ? variable.toString() : 'undefined'
      const valueStr =
        value === undefined ? 'undefined' : Constant.toString(value)
      return `${varStr}:${valueStr}`
    })
    .sort()

  return context + '[' + mappedEntries.join(',') + ']'
}

/**
 * @implements {API.Every<API.Conjunct|API.Recur>}
 */
class Join {
  /**
   * @param {object} source
   * @param {Map<string, API.Variable>} source.bindings
   * @param {string} source.name
   * @param {API.Every<API.Conjunct|API.Recur>} source.conjuncts
   * @param {Set<API.Variable>} [source.variables]
   */
  static from({
    bindings,
    name,
    conjuncts: members,
    variables = new Set(bindings.values()),
  }) {
    /** @type {Map<API.Variable, number>} */
    const cells = new Map()
    /** @type {Map<API.Variable, number>} */
    const local = new Map()
    // Whether this is a recursive branch or not
    let recurs = false
    let total = 0

    const conjuncts = []

    // Here we asses each conjunct of the join one by one and identify:
    // 1. Cost associated with each binding. If cost is Infinity it implies
    //    that the variable is required input that must be bound by the rule
    //    application.
    // 2. Cost associated with each local variable. Local variables are the ones
    //    that are not exposed in the rule match and are used by the join.
    // 3. Which bindings are inputs and which are outputs.
    // 4. Which conjuncts are negations as those need to be planned after all
    //    other conjuncts.
    for (const member of members) {
      const conjunct = from(member)
      conjuncts.push(conjunct)

      if (conjunct.recurs) {
        recurs = true
      }

      // Recur has cost of Infinity because it can not be measured, there
      // for if we encounter such case we inflate cost exponentially.
      total = combineCosts(total, conjunct.cost)

      for (const [variable, cost] of conjunct.cells) {
        // Only track costs for variables exposed in rule match
        if (variables.has(variable)) {
          const base = cells.get(variable)
          cells.set(
            variable,
            base === undefined ? cost : combineCosts(base, cost)
          )
        }
        // Local variables contribute to base cost
        // TODO: 🤔 Local rule variables fail `circuit.connect` because their
        // names can not be derived from rules.
        else {
          const base = local.get(variable)

          local.set(
            variable,
            base === undefined ? cost : combineCosts(base, cost)
          )
        }
      }
    }

    for (const cost of Object.values(local)) {
      total += cost
    }

    this.ensureBindings(cells, bindings, name)

    return new this(conjuncts, cells, total, recurs, name)
  }

  /**
   * Ensures that given bindings are referenced from inside this join. Throws
   * a `ReferenceError` if there is a binding that is not referenced. The reason
   * if rule contains binding that is not used is in it's body it will either
   * not get bound or will not contribute to the rule in both cases rule is
   * likely not captures intended logic. Note that it theory rule may use some
   * variables only in some logic branches in which case those variables could
   * be considered as required input, but even then it is indicative of bad rule
   * design which could be broken apart into multiple rules which is why we
   * choose to error on side of caution. It is also always possible to consume
   * variable in cases where it really isn't needed.
   *
   * @param {Map<API.Variable, number>} cells
   * @param {Map<string, API.Variable>} bindings
   * @param {string} name
   */
  static ensureBindings(cells, bindings, name) {
    // Verify all bindings are used
    for (const [id, variable] of bindings) {
      if (!cells.has(variable)) {
        throw new ReferenceError(
          `Rule case "${name}" does not bind variable ${variable} that rule matches as "${id}"`
        )
      }
    }
    return this
  }

  /**
   * @param {Conjunct[]} conjuncts
   * @param {Map<API.Variable, number>} cells
   * @param {number} cost
   * @param {boolean} recurs
   * @param {string} name
   */
  constructor(conjuncts, cells, cost, recurs, name) {
    this.conjuncts = conjuncts
    this.cells = cells
    this.cost = cost
    this.name = name
    this.recurs = recurs
  }

  /**
   * @returns {IterableIterator<API.Conjunct|API.Recur>}
   */
  [Symbol.iterator]() {
    return /** @type {IterableIterator<API.Conjunct|API.Recur>} */ (
      this.conjuncts[Symbol.iterator]()
    )
  }

  /**
   * @param {API.Scope} scope
   * @returns {JoinPlan}
   */
  plan(scope) {
    // We create a local copy of the binding because we want to modify it here
    // as we attempt to figure out optimal execution order.
    const local = new Map(scope.bindings)
    /** @type {Map<API.Variable, Set<typeof this.conjuncts[0]>>} */
    const blocked = new Map()
    /** @type {Set<typeof this.conjuncts[0]>} */
    const ready = new Set()
    let cost = 0

    // Initial setup - check which operations are ready vs blocked
    for (const conjunct of this.conjuncts) {
      let requires = 0
      for (const [variable, cost] of conjunct.cells) {
        if (
          cost >= Infinity &&
          !Cursor.has(local, scope.references, variable)
          // &&
          // If it is _ we don't actually need it perhaps
          // TODO: Evaluate if this is correct ❓
          // reference !== $._
        ) {
          requires++
          for (const target of Cursor.resolve(scope.references, variable)) {
            const waiting = blocked.get(target)
            if (waiting) {
              waiting.add(conjunct)
            } else {
              blocked.set(target, new Set([conjunct]))
            }
          }
        }
      }

      if (requires === 0) {
        ready.add(conjunct)
      }
    }

    const ordered = []
    while (ready.size > 0) {
      let top = null

      // Find lowest cost operation among ready ones
      for (const current of ready) {
        const cost = estimate(current, local, scope.references)

        if (!top) {
          top = { cost, current }
        } else if (cost < top.cost) {
          top = { cost, current }
        }
      }

      if (!top) {
        throw new ReferenceError(
          `Cannot plan ${[...blocked.keys()]} deduction without required cells`
        )
      }

      ordered.push(top.current.plan(scope))
      ready.delete(top.current)
      cost = combineCosts(cost, top.cost)

      const unblocked = top.current.cells
      // Update local scope so all the cells of the planned assertion will
      // be bound.
      for (const [cell] of unblocked) {
        if (!Cursor.has(local, scope.references, cell)) {
          Cursor.set(local, scope.references, cell, NOTHING)
        }
      }

      // No we attempt to figure out which of the blocked assertions are ready
      // for planning
      for (const [cell] of unblocked) {
        // We resolve a cell to a variable as all blocked operations are tracked
        // by resolved variables because multiple local variable may be bound to
        // same target variable.
        // const variable = Cursor.resolve(local.references, cell)
        for (const variable of Cursor.resolve(scope.references, cell)) {
          const waiting = blocked.get(variable)
          if (waiting) {
            for (const conjunct of waiting) {
              let unblock = true
              // Go over all the cells in this assertion that was blocked on this
              // variable and check if it can be planned now.
              for (const [cell, cost] of conjunct.cells) {
                // const variable = Cursor.resolve(local.references, cell)
                for (const variable of Cursor.resolve(scope.references, cell)) {
                  // If cell is required and is still not available, we can't
                  // unblock it yet.
                  if (
                    cost >= Infinity &&
                    !Cursor.has(local, scope.references, variable)
                  ) {
                    unblock = false
                    break
                  }
                }
              }

              if (unblock) {
                ready.add(conjunct)
              }
            }
            // blocked.delete(variable)
            blocked.delete(variable)
          }
        }
      }
    }

    if (blocked.size > 0) {
      const [[constraint]] = blocked.values()
      for (const [cell, cost] of constraint.cells) {
        if (cost >= Infinity && !Cursor.has(local, scope.references, cell)) {
          throw new ReferenceError(
            `Unbound ${cell} variable referenced from ${toDebugString(
              constraint
            )}`
          )
        }
      }
    }

    return new JoinPlan(ordered, scope.references, cost)
  }

  toJSON() {
    return [...this.conjuncts]
  }

  toDebugString() {
    const content = [...this.conjuncts.map(toDebugString)].join(',\n  ')

    return `[${content}]`
  }
}

/**
 * @typedef {Select|FormulaApplication|RuleApplication} Constraint
 * @typedef {Select|FormulaApplication|RuleApplication|Negation|RuleRecursion} Conjunct
 * @implements {API.Negation}
 */
class Negation {
  /**
   * @param {API.Negation} source
   * @returns {Negation}
   */
  static from({ not: constraint }) {
    const operation = /** @type {Constraint} */ (from(constraint))

    // Not's cost includes underlying operation
    const cells = new Map()
    for (const [variable, cost] of operation.cells) {
      // Not marks all the cells as required inputs as they
      // need to be bound before not can be evaluated, since it
      // only eliminates matches.
      cells.set(variable, Infinity)
    }

    return new this(operation, cells)
  }

  get recurs() {
    return null
  }

  /**
   * @param {Constraint} constraint
   * @param {Map<API.Variable, number>} cells
   */
  constructor(constraint, cells) {
    this.constraint = constraint
    this.cells = cells
  }

  get not() {
    return /** @type {API.Constraint} */ (this.constraint)
  }

  get cost() {
    return this.constraint.cost
  }

  /**
   * @param {API.Scope} scope
   * @returns {NegationPlan}
   */
  plan(scope) {
    return new NegationPlan(this.constraint.plan(scope))
  }

  toDebugString() {
    return `{ not: ${toDebugString(this.constraint)} }`
  }
}

class JoinPlan {
  /**
   * @param {API.EvaluationPlan[]} conjuncts - Ordered plans
   * @param {API.Cursor} references - Variable references
   * @param {number} cost - Total cost of the plan
   */
  constructor(conjuncts, references, cost) {
    this.conjuncts = conjuncts
    this.references = references
    this.cost = cost
  }

  /**
   * @param {API.EvaluationContext} context
   */
  *evaluate({ source, self, selection, recur }) {
    // Execute binding steps in planned order
    for (const plan of this.conjuncts) {
      selection = yield* plan.evaluate({
        source,
        self,
        selection,
        recur,
      })
    }

    return selection
  }

  toJSON() {
    return [...this.conjuncts.map(toJSON)]
  }

  debug() {
    return [...this.conjuncts.map(($) => debug($))].join('\n')
  }

  toDebugString() {
    const body = [...this.conjuncts.map(($) => toDebugString($))]
    return `[${indent(`\n${body.join(',\n')}`)}\n]`
  }
}

/**
 * @template {API.Conclusion} [Match=API.Conclusion]
 */
class DeductiveRulePlan {
  /**
   * @param {Match} match
   * @param {API.Scope} scope
   * @param {Record<string, JoinPlan>} disjuncts
   * @param {number} cost
   * @param {boolean} recurs
   */
  constructor(match, scope, disjuncts, cost, recurs) {
    this.match = match
    this.scope = scope
    this.disjuncts = disjuncts
    this.cost = cost
    this.recurs = recurs
  }
  get when() {
    return this.disjuncts
  }
  toJSON() {
    const { match, disjuncts } = this
    const branches = Object.entries(disjuncts).map(([name, plan]) => [
      name,
      toJSON(plan),
    ])
    const when = Object.fromEntries(branches)

    return branches.length === 1 && branches[0][1].length === 0 ?
        { match }
      : { match, when }
  }

  debug() {
    const head = `${Object.keys(this.match)}`
    let body = ['']
    for (const [name, disjunct] of Object.entries(this.disjuncts)) {
      body.push(`:${name}\n[${indent(`${debug(disjunct)}]`, ' ')}`)
    }

    return `(rule (${head})${indent(body.join('\n'))})`
  }

  toDebugString() {
    const disjuncts = Object.entries(this.disjuncts)
    const when = []
    if (disjuncts.length === 1) {
      const [[name, plan]] = disjuncts
      when.push(indent(toDebugString(plan)))
    } else {
      when.push('{\n')
      for (const [name, disjunct] of disjuncts) {
        when.push(`  ${name}: ${indent(toDebugString(disjunct))},\n`)
      }
      when.push('}')
    }

    return `{
  match: ${indent(Terms.toDebugString(this.match))},
  when: ${indent(when.join(''))}
}`
  }

  /**
   * @param {object} input
   * @param {API.Querier} input.source
   */
  *query({ source }) {
    const { match: selector } = this

    const frames = yield* this.evaluate({
      source,
      self: this,
      selection: [new Map()],
      recur: [], // Array for pairs of [nextBindings, originalContext]
    })

    return Selector.select(selector, frames)
  }

  /**
   *
   * @param {API.EvaluationContext} context
   * @returns
   */
  *evaluate(context) {
    const matches = []
    // Run each branch and combine results
    for (const plan of Object.values(this.disjuncts)) {
      const bindings = yield* plan.evaluate(context)
      matches.push(...bindings)
    }
    return matches
  }
}

class Selector {
  /**
   * @template {API.Selector} Selector
   * @param {Selector} selector
   * @param {Iterable<API.MatchFrame>} frames
   * @returns {API.InferBindings<Selector>[]}
   */
  static select(selector, frames) {
    /** @type {API.InferBindings<Selector>[]} */
    const selection = []
    for (const frame of frames) {
      if (selection.length === 0) {
        selection.push(this.match(selector, frame))
      } else {
        let joined = false
        for (const [offset, match] of selection.entries()) {
          const merged = this.merge(selector, frame, match)
          if (merged) {
            selection[offset] = merged
            joined = true
          }
        }

        if (!joined) {
          selection.push(this.match(selector, frame))
        }
      }
    }

    return selection
  }
  /**
   * @template {API.Selector} Selector
   * @param {Selector} selector
   * @param {API.MatchFrame} bindings
   * @returns {API.InferBindings<Selector>}
   */
  static match(selector, bindings) {
    return Array.isArray(selector) ?
        [
          Variable.is(selector[0]) ? bindings.get(selector[0])
          : Constant.is(selector[0]) ? selector[0]
          : this.match(selector[0], bindings),
        ]
      : Object.fromEntries(
          Object.entries(selector).map(([key, term]) => {
            if (Variable.is(term)) {
              const value = bindings.get(term)
              return [key, value]
            } else if (Constant.is(term)) {
              return [key, term]
            } else {
              return [key, this.match(term, bindings)]
            }
          })
        )
  }

  /**
   * @template {API.Selector} Selector
   * @param {Selector} selector
   * @param {API.MatchFrame} bindings
   * @param {API.InferBindings<Selector>} base
   * @returns {API.InferBindings<Selector>|null}
   */
  static merge(selector, bindings, base) {
    if (Array.isArray(selector)) {
      const [term] = selector
      const extension =
        Variable.is(term) ? bindings.get(term)
        : Constant.is(term) ? term
        : this.match(term, bindings)
      return /** @type {API.InferBindings<Selector>} */ (
        add(/** @type {unknown[]} */ (base), extension)
      )
    } else {
      const entries = []
      for (const [key, term] of Object.entries(selector)) {
        const id = /** @type {keyof API.InferBindings<Selector>} */ (key)
        if (Term.is(term)) {
          const value = /** @type {API.Scalar|undefined} */ (
            Variable.is(term) ? bindings.get(term) : term
          )

          if (value === undefined) {
            return null
          } else {
            if (Constant.equal(/** @type {API.Scalar} */ (base[id]), value)) {
              entries.push([key, value])
            } else {
              return null
            }
          }
        } else {
          const value = this.merge(
            term,
            bindings,
            /** @type {any} */ (base[id])
          )
          if (value === null) {
            return null
          } else {
            entries.push([key, value])
          }
        }
      }
      return Object.fromEntries(entries)
    }
  }
}

/**
 *
 * @param {{}} source
 */
export const toJSON = (source) =>
  // @ts-expect-error
  typeof source.toJSON === 'function' ? source.toJSON() : source

/**
 *
 * @param {{}} source
 * @returns {string}
 */
export const toDebugString = (source) =>
  // @ts-expect-error
  typeof source.toDebugString === 'function' ?
    // @ts-expect-error
    source.toDebugString()
  : JSON.stringify(source)

/**
 * @template {API.Conclusion} [Match=API.Conclusion]
 */
class RuleApplicationPlan {
  /**
   * @param {Partial<API.RuleBindings<Match>>} match
   * @param {DeductiveRule<Match>} rule
   * @param {API.Cursor} references
   * @param {API.MatchFrame} bindings
   */
  constructor(match, rule, references, bindings) {
    this.match = match
    this.rule = rule
    this.references = references
    this.bindings = bindings
    this.plan = rule.plan(this)
  }

  get cost() {
    return this.plan.cost
  }

  /**
   * Helper function to create a full match combining input and output bindings
   * @param {Map<API.Variable, API.Scalar>} input
   * @param {Map<API.Variable, API.Scalar>} output
   * @param {API.Cursor} references
   * @param {API.MatchFrame} bindings
   * @returns {Map<API.Variable, API.Scalar>|null}
   */
  createFullMatch(input, output, references, bindings) {
    // Create a new map starting with the input bindings
    const match = new Map(input)

    // Copy derived bindings from the output
    for (const [inner, outer] of references) {
      for (const source of outer) {
        const value = output.get(source)
        if (value !== undefined) {
          try {
            Cursor.merge(match, references, source, value)
          } catch {
            return null
          }
          //   match.set(outer, value)
          // try {
          //   merge(context, outer, value, match)
          // } catch {
          //   return null
          // }
          // match.set(outer, value)
        }
      }
    }

    // Copy constant bindings from the context
    for (const [variable, value] of bindings) {
      match.set(variable, value)
    }

    return match
  }

  /**
   * Helper to create a transitive match combining input with output
   * @param {Map<API.Variable, API.Scalar>} input
   * @param {Map<API.Variable, API.Scalar>} originalContext
   * @param {Map<API.Variable, API.Scalar>} output
   * @returns {Map<API.Variable, API.Scalar>}
   */
  createTransitiveMatch(input, originalContext, output) {
    const result = new Map(input)

    // First, preserve all bindings from the original context
    // This is critical to maintain properties like 'name'
    for (const [key, value] of originalContext.entries()) {
      result.set(key, value)
    }

    // Then carefully merge bindings from the output
    for (const [key, value] of output.entries()) {
      if (!originalContext.has(key)) {
        result.set(key, value)
      }
    }

    return result
  }

  /**
   * @param {API.EvaluationContext} context
   */
  *evaluate({ source, selection }) {
    const matches = []
    const allResults = new Map() // Map identity -> actual match for deduplication

    for (const input of selection) {
      const bindings = new Map()
      for (const [name, term] of Object.entries(this.match)) {
        const value = Cursor.get(
          input,
          this.references,
          /** @type {API.Term} */ (term)
        )

        const variable = this.plan.match[name]

        if (value !== undefined && variable !== undefined) {
          Cursor.set(bindings, this.references, variable, value)
        }
      }

      // // Copy constant bindings from the application context
      // const bindings = new Map(this.context.bindings)

      // // Copy bindings for the references from the selected match
      // for (const [inner, outer] of this.context.references.entries()) {
      //   const value = input.get(outer)
      //   if (value !== undefined) {
      //     bindings.set(outer, value)
      //   }
      // }

      // Create evaluation context for the main evaluation
      /** @type {API.EvaluationContext} */
      const context = {
        source,
        self: this.plan,
        selection: [bindings],
        recur: [], // Array for recursive steps
      }

      // First evaluate the base case
      const base = yield* this.plan.evaluate(context)

      // Process base results
      for (const result of base) {
        const match = this.createFullMatch(
          input,
          result,
          this.references,
          this.bindings
        )

        if (match) {
          const matchId = identifyMatch(match)
          if (!allResults.has(matchId)) {
            allResults.set(matchId, match)
            matches.push(match)
          }
        }
      }

      // Track all contexts to handle transitive relationships correctly
      // Map from each binding to all its ancestor contexts
      const contextChains = new Map()

      // Initialize the context chains with the original recursive steps
      for (const [nextBinding, originalContext] of context.recur) {
        contextChains.set(nextBinding, [originalContext])
      }

      // Process recursion using breadth-first evaluation
      let { recur } = context

      while (recur.length > 0) {
        /** @type {API.EvaluationContext['recur']} */
        const next = []

        for (const [nextBinding, origContext] of recur) {
          // 🤔 Sounds like we need to map context

          // Create a context for this step's evaluation
          /** @type {API.EvaluationContext} */
          const recursiveContext = {
            source,
            self: this.plan,
            selection: [nextBinding],
            recur: [],
          }

          // Evaluate this step
          const stepResults = yield* this.plan.evaluate(recursiveContext)

          // Process direct results
          for (const stepResult of stepResults) {
            // Create direct result from this step
            const directMatch = this.createFullMatch(
              input,
              stepResult,
              this.references,
              this.bindings
            )

            if (directMatch) {
              const directId = identifyMatch(directMatch)
              if (!allResults.has(directId)) {
                allResults.set(directId, directMatch)
                matches.push(directMatch)
              }
            }

            // Create transitive relationships with all ancestor contexts
            const ancestorContexts = contextChains.get(nextBinding) || []
            for (const ancestorContext of ancestorContexts) {
              const transitiveMatch = this.createTransitiveMatch(
                input,
                ancestorContext,
                stepResult
              )

              const transitiveId = identifyMatch(transitiveMatch)
              if (!allResults.has(transitiveId)) {
                allResults.set(transitiveId, transitiveMatch)
                matches.push(transitiveMatch)
              }
            }
          }

          // Process new recursive steps
          for (const [newBinding, originalBinding] of recursiveContext.recur) {
            // Track context chains for transitive relationships
            const ancestorContexts = contextChains.get(nextBinding) || []
            const newContexts = [origContext, ...ancestorContexts]
            contextChains.set(newBinding, newContexts)

            // Add to next batch
            next.push([newBinding, origContext])
          }
        }

        recur = next
      }
    }

    return matches
  }

  toJSON() {
    return {
      match: this.match,
      rule: toJSON(this.plan),
    }
  }

  /**
   * @param {object} input
   * @param {API.Querier} input.from
   */
  *query({ from: source }) {
    const { match: selector } = this

    const frames = yield* this.evaluate({
      source,
      self: this.plan,
      selection: [new Map()],
      recur: [], // Array for pairs of [nextBindings, originalContext]
    })

    return Selector.select(/** @type {Match} */ (selector), frames)
  }

  /**
   * @param {object} source
   * @param {API.Querier} source.from
   */
  select(source) {
    return Task.perform(this.query(source))
  }

  toDebugString() {
    const { match, plan } = this

    return indent(`{
  match: ${indent(Terms.toDebugString(/** @type {{}} */ (match)))},
  rule: ${indent(toDebugString(plan))}
}`)
  }
}
/**
 * Calculates cost of the executing this operation.
 *
 * @param {object} operation
 * @param {number} [operation.cost]
 * @param {Map<API.Variable, number>} operation.cells
 * @param {API.MatchFrame} bindings
 * @param {API.Cursor} cursor
 */
const estimate = ({ cells, cost = 0 }, bindings, cursor) => {
  let total = cost
  for (const [variable, cost] of cells) {
    if (!Cursor.has(bindings, cursor, variable)) {
      total += cost
    }
  }
  return total
}

/**
 * @param {number} total
 * @param {number} cost
 */
const combineCosts = (total, cost) => {
  if (total >= Infinity) {
    return cost
  } else if (cost >= Infinity) {
    return total
  } else {
    return total + cost
  }
}

class NegationPlan {
  /**
   * @param {API.EvaluationPlan} operand
   */
  constructor(operand) {
    this.operand = operand
  }

  /**
   * @param {API.EvaluationContext} context
   */
  *evaluate({ source, self, selection, recur }) {
    const matches = []
    for (const bindings of selection) {
      const excluded = yield* this.operand.evaluate({
        source,
        self,
        selection: [bindings],
        recur,
      })

      if (excluded.length === 0) {
        matches.push(bindings)
      }
    }

    return matches
  }

  toJSON() {
    return { not: toJSON(this.operand) }
  }

  toDebugString() {
    return `{ not: ${toDebugString(this.operand)} }`
  }
}

export const NOTHING = Link.of({ '/': 'bafkqaaa' })

/**
 *
 * @param {any} source
 * @returns
 */

export const debug = (source) => {
  return source.debug ? source.debug() : JSON.stringify(source, null, 2)
}
