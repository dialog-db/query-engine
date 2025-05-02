import * as API from './api.js'
import * as Variable from './variable.js'
import * as Terms from './terms.js'
import * as Term from './term.js'
import { indent } from './data/string/format.js'
import { _, $ } from './$.js'
import * as Cursor from './cursor.js'
import * as Match from './match.js'
import * as Plan from './plan.js'
import { toDebugString } from './debug.js'

export { $ }

/**
 * For each form we define classes like `Select`, `Join`, `RuleApplication`,
 * etc... representing parsed syntax forms. They all have `plan` method that
 * either error or produce corresponding `SelectPlan`, `JoinPlan`,
 * `RuleApplicationPlan` etc... forms that represent execution plan for the
 * original syntax form. During planning we perform following static analysis:
 *
 * 1. Reslove local variables to variables in the parent scope.
 * 2. Analyze which variables must be bound (e.g. formula inputs must be where's
 * bound select variables reduce search space but do not need to be bound).
 * 3. Reorder rule clause for optimal execution.
 *
 * Method fails when required variable is not bound in the upper scope or when
 * some rule bindings are not passed during application.
 *
 * ℹ️ Two phases are required because prase takes place bottom up (leaf forms
 * are parsed first) and we can not analyze scope because forms above have not
 * being parsed yet. However once we have parsed syntax forms we have all the
 * information to perform static analisys.
 */

/**
 * @param {API.Select} selector
 */
export const select = (selector) => Select.from({ match: selector })

/**
 * @template {API.Proposition} Match
 * @param {API.DeductiveRule<Match>} source
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
 * @template {API.Proposition} [Match=API.Proposition]
 * @param {API.RuleBindings<Match>} terms
 */
export const recur = (terms) => RuleRecursion.from({ recur: terms })

/**
 * @param {API.Conjunct|API.Recur} source
 */
export const from = (source) => {
  if (source instanceof Negation) {
    return source
  } else if (source instanceof RuleApplication) {
    return source
  } else if (source instanceof FormulaApplication) {
    return source
  } else if (source instanceof RuleRecursion) {
    return source
  } else if (source instanceof Select) {
    return source
  } else if (source.not) {
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

const NONE = new Map()

/**
 * @implements {API.SelectForm}
 * @implements {API.SelectSyntax}
 */
class Select {
  /**
   * @param {API.SelectForm} source
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

  get references() {
    return NONE
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
    return new Plan.Select(this, references, bindings)
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
        /** @type {Record<string, API.Term>} */ ({
          ...rest,
          ...(of ? { of } : null),
        })
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

  get references() {
    return NONE
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
    return new Plan.FormulaApplication(
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
}

/**
 * @template {API.Proposition} [Match=API.Proposition]
 * @implements {API.MatchRule<Match>}
 * @implements {API.RuleApplicationSyntax<Match>}
 */
export class RuleApplication {
  /**
   * @template {API.Proposition} [Match=API.Proposition]
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
   * @template {API.Proposition} Match
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
          `Rule application omits required parameter "${at}"`
        )
      }

      // If binding term is a variable itself we combine costs. For example if
      // we had `{x, y}` rule variables both mapped to same `$.q` variable total
      // cost of `$.q` would be costs of `x` and `y` (inside rule body) combined.
      if (Variable.is(term)) {
        // If some cell is required we need to make sure that it remains so
        // after we combine the cost estimates.
        cells.set(term, (cells.get(term) ?? 0) + cost)

        /**
         * We also add a `variable → term` mapping to the `references` so that
         * during evalutaion we will know which variables to set.
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
         * Here we will end up `$.x → $.a` and then with `$.x → $.b`.
         */
        Cursor.link(references, variable, term)
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

      // Also if we do have a constant term for a variable we need to reset
      // corresponding cells to 0 as they will costs nothing. This is important
      // because some cells may have cost of `Infinity` otherwise rendering
      // rule application unplannable.
      for (const cell of Cursor.resolve(references, variable)) {
        // Please note that only cells application can have are variables in the
        // `terms` which we have already iterated and collected in the cells. If
        // we do not collected this cell, we should not set it because it may
        // lead setting things into outer scope.
        if (cells.has(cell)) {
          cells.set(cell, 0)
        }
      }
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

          // If rule application was binding this variable we propagate it
          const constant = Cursor.get(bindings, this.references, inner)
          const value =
            constant !== undefined ? constant
              // `variable` also may be bound to a constant in the outer scope
            : Cursor.get(scope.bindings, scope.references, variable)

          // If we variable was set in scope we copy it into a local bindings.
          if (value !== undefined) {
            Cursor.set(bindings, references, inner, value)
          } else if (Cursor.has(scope.bindings, scope.references, variable)) {
            Cursor.markBound(bindings, references, inner)
          }
        }
      }
    }

    return new Plan.RuleApplication(this.match, this.rule, references, bindings)
  }

  /**
   * Caches the application plan so that it can be reused across many queries.
   *
   * @type {API.RuleApplicationPlan<Match>|null}
   */
  #plan = null

  prepare() {
    if (this.#plan == null) {
      this.#plan = this.plan(this)
    }
    return this.#plan
  }

  /**
   * Runs this rule application as a query in on a given `input`.
   *
   * @param {object} input
   * @param {API.Querier} input.from
   */
  query(input) {
    return this.prepare().query(input)
  }

  toDebugString() {
    const { match, rule } = this
    return `{
    match: ${Terms.toDebugString(/** @type {{}} */ (match))},
    rule: ${indent(toDebugString(rule))}
  }`
  }

  toJSON() {
    const { match, rule } = this
    return {
      match: Terms.toJSON(/** @type {API.Terms} */ (match)),
      rule: rule.toJSON(),
    }
  }

  negate() {
    return Negation.new(this)
  }
}

/**
 * Creates map of variables with identifiers as keys and corresponding variables
 * as values. Omits non variable terms
 *
 * @param {API.Proposition} match
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
 * @template {API.Proposition} [Match=API.Proposition]
 * @implements {API.DeductiveRuleSyntax<Match>}
 */
export class DeductiveRule {
  /**
   * @template {API.Proposition} Case
   * @param {API.DeductiveRule<Case>} source
   */
  static from(source) {
    const disjuncts = source.when ?? {}

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
    /** @type {Record<string, Plan.Join>} */
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
      when.where = new Plan.Join([], application.references, 0)
    }

    // // If all branches are recursive raise an error because we need a base case
    // // to terminate.
    // if (recursive > 0 && recursive === disjuncts.length) {
    //   throw new SyntaxError(
    //     `Recursive rule must have at least one non-recursive branch`
    //   )
    // }

    // If recursive rule we inflate the cost by factor
    cost = this.recurs ? cost ** 2 : cost

    return new Plan.DeductiveRule(
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
  ${body}
}`)
  }

  toJSON() {
    return {
      match: Terms.toJSON(this.match),
      when: Object.fromEntries(
        Object.entries(this.when).map(([name, disjunct]) => [
          name,
          disjunct.toJSON(),
        ])
      ),
    }
  }
}

/**
 * @template {API.Proposition} [Match=API.Proposition]
 * @implements {API.RuleRecursionSyntax<Match>}
 */
export class RuleRecursion {
  /**
   * @template {API.Proposition} [Match=API.Proposition]
   * @param {API.Recur<Match>} source
   */
  static from({ recur: terms }) {
    const cells = new Map()
    // All variables in the rule need to be in the cells
    for (const variable of Terms.variables(terms)) {
      // TODO: see https://app.radicle.xyz/nodes/ash.radicle.garden/rad:z21XbgzbqQtfKKJWKuv6cQCyLMJYS/issues/617aaf083d45ec3eba8ddd8d2c587a289e45ea79
      cells.set(variable, 0)
    }

    return new this(terms, cells)
  }

  get recurs() {
    return this
  }

  get references() {
    return NONE
  }

  /**
   * @param {API.RuleBindings<Match>} terms
   * @param {Map<API.Variable, number>} cells
   */
  constructor(terms, cells) {
    this.terms = terms
    this.cells = cells
  }

  get recur() {
    return this.terms
  }

  get cost() {
    return Infinity
  }

  /**
   * @param {API.Scope} scope
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

    // For each match in our current selection
    next: for (const match of selection) {
      // Map variables from the current context to the recursive rule's variables
      const bindings = new Map()
      for (const [name, term] of Object.entries(this.terms)) {
        const value = Match.get(match, term)
        const variable = to[name]
        if (value !== undefined && variable !== undefined) {
          const result = Match.set(bindings, variable, value)
          if (result.error) {
            continue next
          }
        }
      }

      // Simply schedule the recursion - tautology detection will happen in RuleApplicationPlan
      recur.push([bindings, new Map(match)])
    }

    // Recur doesn't directly return matches - it schedules them for later
    return []
  }
}

/**
 * @implements {API.Every<API.Conjunct|API.Recur>}
 */
export class Join {
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
    conjuncts: forms,
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
    for (const form of forms) {
      const conjunct = from(form)
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
   * @returns {Plan.Join}
   */
  plan(scope) {
    // We create a local copy of the binding because we want to modify it here
    // as we attempt to figure out optimal execution order.
    const bindings = new Map(scope.bindings)
    const { references } = scope
    /** @type {Map<API.Variable, Set<typeof this.conjuncts[0]>>} */
    const blocked = new Map()
    /** @type {Set<typeof this.conjuncts[0]>} */
    const ready = new Set()
    let cost = 0

    // Initial setup - check which operations are ready vs blocked
    for (const conjunct of this.conjuncts) {
      let requires = 0
      // TODO: resolvable through unification does not work here because
      // cels $.x and $.is have cost of Infinity and even though we have $.is
      // we still block this because we do not know here that $.x == $.is
      for (const variable of unbound(conjunct, {
        references: scope.references,
        bindings,
      })) {
        // for (const [variable, cost] of conjunct.cells) {
        //   if (
        //     cost >= Infinity &&
        //     !Cursor.has(local, scope.references, variable)
        //     // &&
        //     // If it is _ we don't actually need it perhaps
        //     // TODO: Evaluate if this is correct ❓
        //     // reference !== $._
        //   ) {
        requires++
        for (const target of Cursor.resolve(references, variable)) {
          const waiting = blocked.get(target)
          if (waiting) {
            waiting.add(conjunct)
          } else {
            blocked.set(target, new Set([conjunct]))
          }
        }
      }
      // }

      if (requires === 0) {
        ready.add(conjunct)
      }
    }

    const ordered = []
    while (ready.size > 0) {
      let top = null

      // Find lowest cost operation among ready ones
      for (const current of ready) {
        const cost = estimate(current, bindings, references)

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

      ordered.push(
        top.current.plan({
          bindings,
          references,
        })
      )
      ready.delete(top.current)
      cost = combineCosts(cost, top.cost)

      const unblocked = top.current.cells
      // Update local scope so all the cells of the planned assertion will
      // be bound.
      for (const [cell] of unblocked) {
        if (!Cursor.has(bindings, references, cell)) {
          Cursor.markBound(bindings, references, cell)
        }
      }

      // No we attempt to figure out which of the blocked assertions are ready
      // for planning
      for (const [cell] of unblocked) {
        // We resolve a cell to a variable as all blocked operations are tracked
        // by resolved variables because multiple local variable may be bound to
        // same target variable.
        // const variable = Cursor.resolve(local.references, cell)
        for (const variable of Cursor.resolve(references, cell)) {
          const waiting = blocked.get(variable)
          if (waiting) {
            for (const conjunct of waiting) {
              let unblock = true
              for (const varibale of unbound(conjunct, {
                references: scope.references,
                bindings,
              })) {
                // If there is a wariable that is still not bound this conjunct is
                // still not ready
                unblock = false
                break
              }

              if (unblock) {
                ready.add(conjunct)
              }
            }

            blocked.delete(variable)
          }
        }
      }
    }

    if (blocked.size > 0) {
      const [[constraint]] = blocked.values()
      for (const [cell, cost] of constraint.cells) {
        if (cost >= Infinity && !Cursor.has(bindings, references, cell)) {
          throw new ReferenceError(
            `Unbound ${cell} variable referenced from ${toDebugString(
              constraint
            )}`
          )
        }
      }
    }

    return new Plan.Join(ordered, references, cost)
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
 * @implements {API.NegationSyntax}
 */
export class Negation {
  /**
   * @param {API.Negation} source
   * @returns {Negation}
   */
  static from({ not: constraint }) {
    return this.new(/** @type {Constraint} */ (from(constraint)))
  }

  /**
   * @param {Constraint} constraint
   */
  static new(constraint) {
    // Not's cost includes underlying operation
    const cells = new Map()
    for (const [variable, cost] of constraint.cells) {
      // Not marks all the cells as required inputs as they
      // need to be bound before not can be evaluated, since it
      // only eliminates matches.
      cells.set(variable, Infinity)
    }

    return new this(constraint, cells)
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

  get references() {
    return this.constraint.references
  }

  get not() {
    return /** @type {API.Constraint} */ (this.constraint)
  }

  get cost() {
    return this.constraint.cost
  }

  /**
   * @param {API.Scope} scope
   * @returns {Plan.Negation}
   */
  plan(scope) {
    return new Plan.Negation(this.constraint.plan(scope))
  }

  toJSON() {
    return { not: this.constraint.toJSON() }
  }

  toDebugString() {
    return `{ not: ${toDebugString(this.constraint)} }`
  }
}

// /**
//  * @template {API.Selector} [Selector=API.NamedSelector]
//  */
// export class Selection {
//   /**
//    * @param {Selector} selector
//    * @param {API.MatchFrame[]} matches
//    */
//   constructor(selector, matches) {
//     this.selector = selector
//     this.matches = matches
//   }
//   values() {
//     return Selector.select(this.selector, this.matches)
//   }
//   *[Symbol.iterator]() {
//     yield* Selector.select(this.selector, this.matches)
//   }
//   *entries() {
//     for (const match of this.values()) {
//       yield [match, match]
//     }
//   }
//   get size() {
//     return this.matches.length
//   }

//   /**
//    * @template {API.Selector} Match
//    * @param {Match} selector
//    * @returns {Selection<Match>}
//    */
//   select(selector) {
//     return new Selection(selector, this.matches)
//   }
// }

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

/**
 * @param {Conjunct} conjunct
 * @param {API.Scope} scope
 * @returns
 */
const unbound = function* (conjunct, { bindings, references }) {
  next: for (const [variable, cost] of conjunct.cells) {
    // If cell cost is infinity we want to consider all the other variables
    // this one may be unified with an of them would imply binding.
    if (cost >= Infinity && !Cursor.has(bindings, references, variable)) {
      for (const variant of Cursor.enumerate(conjunct.references, variable)) {
        if (Cursor.has(bindings, references, variant)) {
          continue next
        }
      }

      yield variable
    }
  }
}
