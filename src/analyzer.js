import * as API from './api.js'
import * as Variable from './variable.js'
import * as Terms from './terms.js'
import * as Bindings from './bindings.js'
import * as Term from './term.js'
import { Constant, Link, matchFact, Var, $, _ } from './lib.js'
import { operators } from './formula.js'
import { add } from './selector.js'
import { indent, li } from './format.js'
import * as Task from './task.js'

export { $ }

/**
 * @param {API.Select} selector
 */
export const select = (selector) =>
  Select.new(Circuit.new(), { match: selector })

/**
 * @template {API.Conclusion} Match
 * @param {API.Deduction<Match>} source
 */
export const rule = (source) => DeductiveRule.new(source)

/**
 * @template {API.SystemOperator} Source
 * @param {Source['operator']} operator
 * @param {Source['match']} match
 */
export const apply = (operator, match) =>
  FormulaApplication.new(
    Circuit.new(),
    /** @type {Source} */ ({ operator, match })
  )

/**
 * @template {API.Conclusion} Match
 * @template {Match} Repeat
 * @param {API.Induction<Match, Repeat>} source
 */
export const loop = (source) => InductiveRule.new(source)

/**
 * @template {API.Conclusion} Match
 * @param {API.RuleApplication<Match>} application
 */
export const plan = (application) =>
  RuleApplication.new(Circuit.new(), application).plan()

/**
 * @implements {API.MatchFact}
 */
class Select {
  /**
   * @param {Circuit} circuit
   * @param {API.MatchFact} source
   */
  static new(circuit, { match }) {
    const { of, the, is } = match
    const cells = new Map()
    const select = new this(circuit, match, cells)

    // Entity is variable
    if (Variable.is(of)) {
      cells.set(of, 500)
      circuit.open(of, select)
    }

    // Attribute is a variable
    if (Variable.is(the)) {
      cells.set(the, 200)
      circuit.open(the, select)
    }

    // Value is a variable
    if (Variable.is(is)) {
      cells.set(is, 300)
      circuit.open(is, select)
    }

    return select
  }
  /**
   * @param {Circuit} circuit
   * @param {API.Select} selector
   * @param {Map<API.Variable, number>} cells
   * @param {Context} context
   */
  constructor(circuit, selector, cells, context = ContextView.free) {
    this.circuit = circuit
    this.cells = cells
    this.selector = selector
    this.context = context
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
   * @param {API.Variable} by
   * @returns {SelectRoute|null}
   */
  address(by) {
    /** @type {SelectRoute['match']} */
    const match = {}
    let distance = 0
    let found = false
    for (const [key, term] of Object.entries(this.selector)) {
      if (term == by) {
        found = true
        match[key] = ROUTE_TARGET
      } else if (Variable.is(term)) {
        const route = this.circuit.address(term)
        if (route) {
          match[key] = route
          distance += route.distance
        } else {
          return null
        }
      } else {
        match[key] = term
      }
    }

    return found ? { match, fact: {}, distance } : null
  }

  /**
   * @template {API.Scalar} T
   * @param {Context} context
   * @param {API.Term<T>} term
   * @returns {API.Term<T>}
   */
  static resolve(context, term) {
    if (Variable.is(term)) {
      return /** @type {API.Term<T>} */ (context.references.get(term)) ?? term
    } else {
      return term
    }
  }
  /**
   *
   * @param {Context} context
   */
  plan(context) {
    return new Select(this.circuit, this.selector, this.cells, context)
  }

  /**
   * @template {API.Scalar} T
   * @param {API.Term<T>|undefined} term
   * @param {API.MatchFrame} bindings
   * @returns {API.Term<T>|undefined}
   */
  resolve(term, bindings) {
    if (Variable.is(term)) {
      const reference = this.context ? resolve(this.context, term) : term
      return /** @type {API.Term<T>} */ (bindings.get(reference) ?? reference)
    } else {
      return term
    }
  }

  /**
   * @param {API.EvaluationContext} context
   */
  *evaluate({ source, selection }) {
    const matches = []
    const { selector, context } = this
    for (const bindings of selection) {
      const the = this.resolve(selector.the, bindings)
      const of = this.resolve(selector.of, bindings)
      const is = this.resolve(selector.is, bindings)

      // Note: We expect that there will be LRUCache wrapping the db
      // so calling scan over and over again will not actually cause new scans.
      const facts = yield* source.scan({
        entity: Variable.is(of) ? undefined : of,
        attribute: Variable.is(the) ? undefined : the,
        value: Variable.is(is) ? undefined : is,
      })

      for (const [entity, attribute, value] of facts) {
        try {
          const match = new Map(bindings)

          if (Variable.is(the)) {
            write(context, the, attribute, match)
          }

          if (Variable.is(of)) {
            write(context, of, entity, match)
          }

          if (Variable.is(is)) {
            write(context, is, value, match)
          }

          matches.push(match)
        } catch {}
      }
    }

    return matches
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

  /**
   *
   * @returns
   */
  form() {
    const { circuit, selector } = this
    const { the, of, is } = selector
    const match = {}
    if (the) {
      match.the = address(the, circuit)
    }

    if (of !== undefined) {
      match.of = address(of, circuit)
    }

    if (is !== undefined) {
      match.is = address(is, circuit)
    }

    return { match, fact: {} }
  }

  refer() {
    const { circuit, selector } = this
    const { the, of, is } = selector
    const match = {}
    if (the !== undefined) {
      match.the = circuit.resolve(the)
    }

    if (of !== undefined) {
      match.of = circuit.resolve(of)
    }

    if (is !== undefined) {
      match.is = circuit.resolve(is)
    }

    return Link.of({
      match: match,
      fact: {},
    })
  }

  /**
   * @param {Select} other
   */
  compare(other) {
    const { the, of, is } = this.selector
    const { the: toThe, of: toOf, is: toIs } = other.selector

    let order = Term.compare(the ?? Variable._, toThe ?? Variable._)
    if (order !== 0) {
      return order
    }

    order = Term.compare(of ?? Variable._, toOf ?? Variable._)
    if (order !== 0) {
      return order
    }

    return Term.compare(is ?? Variable._, toIs ?? Variable._)
  }
}

/**
 * @typedef {object} Address
 * @property {API.Variable} the
 * @property {API.Scalar|Route} as
 *
 * @param {API.Term} term
 * @param {Circuit} circuit
 * @returns {Address|API.Scalar}
 */
const address = (term, circuit) => {
  if (Variable.is(term)) {
    const address = circuit.resolve(term)
    return {
      the: term,
      as: toJSON(/** @type {{}} */ (address)),
    }
  } else {
    return term
  }
}

class FormulaApplication {
  /**
   * @param {Circuit} circuit
   * @param {API.SystemOperator} source
   */
  static new(circuit, source) {
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
    const application = new this(circuit, source, cells, from, to)

    for (const variable of Terms.variables(from)) {
      // Cost of omitting an input variable is Infinity meaning that we can not
      // execute the operation without binding the variable.
      cells.set(variable, Infinity)
      circuit.open(variable, application)
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

      circuit.open(variable, application)
    }

    return application
  }

  /**
   * @param {Circuit} circuit
   * @param {API.SystemOperator} source
   * @param {Map<API.Variable, number>} cells
   * @param {Record<string, API.Term>|API.Term} from
   * @param {Record<string, API.Term>} to
   * @param {Context} context
   */
  constructor(circuit, source, cells, from, to, context = ContextView.free) {
    this.circuit = circuit
    this.cells = cells
    this.source = source
    this.from = from
    this.to = to
    this.context = context
  }
  /**
   * Base execution cost of the formula application operation.
   */
  get cost() {
    return 5
  }

  /**
   * @param {Context} context
   */
  plan(context) {
    return new FormulaApplication(
      this.circuit,
      this.source,
      this.cells,
      this.from,
      this.to,
      context
    )
  }

  /**
   * @template {API.Terms} Terms
   * @param {Terms} terms
   * @param {API.MatchFrame} bindings
   * @returns {API.InferTerms<Terms>}
   */
  resolve(terms, bindings) {
    return /** @type {API.InferTerms<Terms>} */ (
      Term.is(terms) ? lookup(this.context, terms, bindings)
      : Array.isArray(terms) ?
        terms.map((term) => lookup(this.context, term, bindings))
      : Object.fromEntries(
          Object.entries(terms).map(([key, term]) => [
            key,
            lookup(this.context, term, bindings),
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
              merge(this.context, cell, extension[key], match)
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

  /**
   * @param {API.Variable} by
   * @returns {FormulaRoute|null}
   */
  address(by) {
    /** @type {FormulaRoute['match']} */
    const match = {}
    let found = false
    let distance = 0
    for (const [key, term] of Object.entries(this.source.match)) {
      if (term === by) {
        found = true
        match[key] = ROUTE_TARGET
      } else if (Variable.is(term)) {
        const route = this.circuit.address(term)
        if (route) {
          match[key] = route
          distance += route.distance
        } else {
          return null
        }
      } else {
        match[key] = term
      }
    }

    return found ? { match, operator: this.source.operator, distance } : null
  }
  form() {
    /** @type {Record<string, Address|API.Scalar>} */
    const match = {}
    for (const [key, term] of Object.entries(this.source.match)) {
      match[key] = address(term, this.circuit)
    }

    return {
      match,
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

/**
 * @template {API.Conclusion} [Match=API.Conclusion]
 * @implements {API.MatchRule<Match>}
 */
export class RuleApplication {
  /**
   * @template {API.Conclusion} [Match=API.Conclusion]
   * @param {Circuit} circuit
   * @param {API.RuleApplication<Match>} source
   * @returns {RuleApplication<Match>}
   */
  static new(circuit, source) {
    // Build the underlying rule first
    const rule =
      isInductive(source.rule) ?
        InductiveRule.new(source.rule)
      : DeductiveRule.new(source.rule)

    return this.apply(rule, source.match, circuit)
  }
  /**
   * @template {API.Conclusion} Match
   * @param {DeductiveRule<Match>|InductiveRule<Match>} rule
   * @param {Partial<API.RuleBindings<Match>>} terms
   * @param {Circuit} circuit
   */
  static apply(rule, terms, circuit) {
    const application = new this(circuit, terms, rule)
    const { context, cells } = application

    for (const [at, inner] of Object.entries(rule.match)) {
      const term = terms[at]
      const cost = rule.cells.get(inner) ?? 0
      // If binding is not provided during application, but it is used as input
      // inside a rule we raise a reference error because variable is not bound.
      if (term === undefined && cost >= Infinity) {
        throw new ReferenceError(
          `Rule application omits required binding for "${at}"`
        )
      }

      // If provided term in the rule application is a variable we create a
      // mapping between rules inner variable and the term - application
      // variable.
      if (Variable.is(term)) {
        // We combine costs as we may have same outer variable set to different
        // inner variables.
        cells.set(term, combineCosts(cells.get(term) ?? 0, cost))
        redirect(context, inner, term)

        circuit.open(term, application)
      }
      // If value for the term is provided we create a binding.
      else if (term !== undefined) {
        write(context, inner, term, context.bindings)
      }
      // Otherwise we create a reference to the `_` discarding variable.
      else {
        // createReference(context, inner, _)
      }
    }

    return application
  }
  /**
   * @param {Circuit} circuit
   * @param {Partial<API.RuleBindings<Match>> & {}} match
   * @param {DeductiveRule<Match>|InductiveRule<Match>} rule
   * @param {Context} context
   * @param {Map<API.Variable, number>} cells
   */
  constructor(
    circuit,
    match,
    rule,
    context = ContextView.new(),
    cells = new Map()
  ) {
    this.circuit = circuit
    this.match = match
    this.rule = rule
    this.context = context
    this.cells = cells
  }

  /**
   * @param {API.Variable} by
   * @returns {RuleRoute|null}
   */
  address(by) {
    let found = false
    /** @type {RuleRoute['match']} */
    const match = {}
    let distance = 0
    for (const [name, term] of Object.entries(this.match)) {
      if (term === by) {
        match[name] = ROUTE_TARGET
        found = true
      } else if (Variable.is(term)) {
        const route = this.circuit.address(term)
        if (route) {
          match[name] = route
          distance += route.distance
        } else {
          return null
        }
      } else {
        match[name] = /** @type {API.Scalar} */ (term)
      }
    }

    return found ? { match, rule: this.rule.form(), distance } : null
  }
  form() {
    /** @type {Record<string, Address|API.Scalar>} */
    const match = {}
    for (const [name, term] of Object.entries(this.match)) {
      match[name] = address(/** @type {API.Scalar} */ (term), this.circuit)
    }

    return {
      match: {},
      rule: this.rule.form(),
    }
  }

  get cost() {
    return this.rule.cost
  }

  /**
   * @param {Context} context
   */
  plan(context = ContextView.free) {
    // create a context that shares references with `this.context` and
    // that has copy of bindings. We will use it to bind values from the
    // outer context.
    const application = ContextView.new(
      this.context.references,
      new Map(this.context.bindings)
    )

    // And copy bindings for the references into it.
    for (const [inner, outer] of application.references) {
      const reference = resolve(context, outer)
      let value = get(context, reference)
      if (reference !== outer) {
        value = value ?? get(context, inner)
        redirect(application, inner, reference)
      }

      if (value !== undefined) {
        bind(application, inner, value)
      }
    }

    return new RuleApplicationPlan(
      this.match,
      this.rule.plan(application),
      this.context
    )
  }

  /**
   * @param {object} input
   * @param {API.Querier} input.from
   */
  select(input) {
    return Task.perform(this.plan().query(input))
  }

  toDebugString() {
    const { match, rule } = this
    return `{ match: ${Terms.toDebugString(
      /** @type {{}} */ (match)
    )}, rule: ${toDebugString(rule)} }`
  }
}

/**
 * @param {API.Conclusion} match
 * @returns {Map<API.Variable, string>}
 */
const ruleBindings = (match) => {
  const bindings = new Map()
  for (const [name, variable] of Object.entries(match)) {
    if (Variable.is(variable)) {
      bindings.set(variable, name)
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
  static new(source) {
    const disjuncts =
      Array.isArray(source.when) ? { when: source.when } : source.when ?? {}

    let cells = new Map()
    let total = 0
    /** @type {Record<string, Join>} */
    const when = {}
    const bindings = ruleBindings(source.match)

    const entries = Object.entries(disjuncts)
    for (const [name, conjuncts] of entries) {
      const deduction = Join.from({
        name,
        conjuncts,
        bindings,
      }).ensureBindings(bindings)
      total += deduction.cost
      when[name] = deduction

      for (const [variable, cost] of deduction.cells) {
        const currentCost = cells.get(variable) ?? 0
        cells.set(variable, currentCost + cost)
      }
    }

    // If no disjuncts, all match variables are required inputs as they
    // must unify by relation.
    if (entries.length === 0) {
      for (const variable of bindings.keys()) {
        cells.set(variable, Infinity)
      }
    }

    return new this(source.match, cells, total, when)
  }

  /**
   * @param {Match} match - Pattern to match against
   * @param {Map<API.Variable, number>} cells - Cost per variable when not bound
   * @param {number} cost - Base execution cost
   * @param {Record<string, Join>} when - Named deductive branches that must be evaluated
   */
  constructor(match, cells, cost, when) {
    this.match = match
    this.cells = cells
    this.cost = cost
    this.disjuncts = when
  }

  /** @type {API.When} */
  get when() {
    return /** @type {any} */ (this.disjuncts)
  }

  /**
   * @param {Partial<API.RuleBindings<Match>>} terms
   * @returns {RuleApplication<Match>}
   */
  apply(terms = this.match) {
    return RuleApplication.apply(this, terms, Circuit.new())
  }

  /**
   * @param {Context} context
   */
  plan(context) {
    /** @type {Record<string, ReturnType<typeof Join.prototype.plan>>} */
    const when = {}
    let cost = 0
    const disjuncts = Object.entries(this.disjuncts)
    for (const [name, disjunct] of disjuncts) {
      const plan = disjunct.plan(context)
      when[name] = plan
      cost += plan.cost
    }

    // If we have no disjuncts there will be nothing raising problem if required
    // cell is not bound, which can happen in rules like this one
    // rule({ match: { this: $, as: $ } })
    // Which is why we need to perform validation here in such a case.
    if (disjuncts.length === 0) {
      for (const [cell, cost] of this.cells) {
        const variable = resolve(context, cell)
        if (cost >= Infinity && !isBound(context, variable)) {
          const reference =
            cell !== variable ? `${cell} referring to ${variable}` : cell
          throw new ReferenceError(
            `Rule application requires binding for ${reference} variable`
          )
        }
      }
    }

    return new DeductivePlan(this.match, when, cost)
  }

  toDebugString() {
    const disjuncts = Object.entries(this.disjuncts)
    const when = []
    for (const [name, disjunct] of disjuncts) {
      when.push(`${name}: ${toDebugString(disjunct)}`)
    }
    const body =
      when.length === 1 ? when[0] : `when: { ${indent(when.join(',\n'))} }`

    return `{
  match: ${Terms.toDebugString(this.match)},
  ${body}}
}`
  }

  /**
   * @returns {{}}
   */

  form() {
    /** @type {Record<string, object>} */
    const form = {}

    for (const [name, disjunct] of Object.entries(this.disjuncts)) {
      form[name] = disjunct.form()
    }

    return form
  }
}

/**
 * @template {API.Conclusion} [Match=API.Conclusion]
 * @template {Match} [Repeat=Match]
 * @implements {API.Induction<Match, Repeat>}
 */
class InductiveRule {
  /**
   * @template {API.Conclusion} Match
   * @template {Match} [Repeat=Match]
   * @param {API.Induction<Match, Repeat>} source
   */
  static new(source) {
    const bindings = ruleBindings(source.match)

    // If `source.when` is not an array we throw an exception as it must be
    // provided to form a base case.
    if (!Array.isArray(source.when) || source.when.length === 0) {
      throw new SyntaxError(
        'Inductive rule must have "when" property establishing base case of recursion'
      )
    }

    // Analyze initial conditions
    const when = Join.from({
      name: 'when',
      conjuncts: source.when,
      bindings,
    }).ensureBindings(bindings)

    // Create rule instance first
    let cells = new Map(when.cells)
    // Base const contains `when` cost
    let total = when.cost

    const disjuncts =
      Array.isArray(source.while) ? { while: source.while } : source.while

    /** @type {Record<string, Join>} */
    const induction = {}

    // Now we add variables from the `source.repeat` as it likely rebinds some
    // of them in order to drive the loop. We keep old variables also as those
    // need to be used by while loop in some way.
    const repeat = ruleBindings(source.repeat)
    for (const [variable, name] of repeat) {
      bindings.set(variable, name)
    }

    // We copy all the bindings found in the source.match and source.repeat and
    // then remove those that are in both, as those are forwarded and do not
    // need to be bound in the while.
    const required = new Map(bindings)
    for (const [name, variable] of Object.entries(source.match)) {
      if (repeat.has(variable)) {
        required.delete(variable)
      }
    }

    for (const [name, conjuncts] of Object.entries(disjuncts)) {
      const deduction = Join.from({
        name,
        conjuncts,
        bindings,
      }).ensureBindings(required)
      total += deduction.cost ** 2
      induction[name] = deduction

      // And cost from the induction clause
      for (const [variable, cost] of deduction.cells) {
        const currentCost = cells.get(variable) ?? 0
        cells.set(variable, currentCost + cost ** 2)
      }
    }

    // Ensure that repeat and match both provide same bindings
    const matchKeys = Object.keys(source.match)
    const repeatKeys = Object.keys(source.repeat)
    for (const name of matchKeys) {
      if (!repeatKeys.includes(name)) {
        throw new ReferenceError(
          `Rule has inconsistent bindings across repeat: ${Terms.toDebugString(
            source.repeat
          )} and match: ${Terms.toDebugString(
            source.match
          )}\n  - "${name}" is missing in repeat`
        )
      }
    }

    return new this(source.match, when, source.repeat, induction, cells, total)
  }

  /**
   * @param {Match} match - Initial pattern to match
   * @param {Join} when - Initial conditions that must be met
   * @param {Repeat} repeat - Pattern to match in recursive iterations
   * @param {Record<string, Join>} loop - Named branches for recursive conditions
   * @param {Map<API.Variable, number>} cells - Cost per variable when not bound
   * @param {number} cost - Base cost including initial conditions and exponentially weighted recursive costs.
   */
  constructor(match, when, repeat, loop, cells, cost) {
    this.match = match
    this.base = when
    this.repeat = repeat
    this.loop = loop
    this.cells = cells
    this.cost = cost
  }

  /** @type {API.Every} */
  get when() {
    return /** @type {any} */ (this.base)
  }

  /** @type {API.When} */
  get while() {
    return /** @type {any} */ (this.loop)
  }
  /**
   * @param {API.RuleBindings<Match>} terms
   * @returns {RuleApplication<Match>}
   */
  apply(terms) {
    return RuleApplication.apply(this, terms, Circuit.new())
  }

  /**
   * @param {Context} context
   */
  plan(context) {
    const when = this.base.plan(context)
    let cost = when.cost
    /** @type {Record<string, ReturnType<typeof Join.prototype.plan>>} */
    const loop = {}
    for (const [name, deduction] of Object.entries(this.loop)) {
      const plan = deduction.plan(context)
      loop[name] = plan
      cost += plan.cost ** 2
    }

    return new InductionPlan(when, loop, cost)
  }

  /**
   * @returns {object}
   */
  form() {
    /** @type {Record<string, object>} */
    const loop = {}
    for (const [name, disjunct] of Object.entries(this.loop)) {
      loop[name] = disjunct.form()
    }

    return {
      when: this.base.form(),
      while: loop,
    }
  }
}

/**
 * @template {API.Conclusion} [Match=API.Conclusion]
 * @param {API.Rule<Match>} rule
 * @returns {rule is API.Induction<Match>}
 */
const isInductive = (rule) => rule.repeat !== undefined

class Join {
  /**
   * @param {object} source
   * @param {Map<API.Variable, string>} source.bindings
   * @param {string|number} source.name
   * @param {API.Every} source.conjuncts
   */
  static from({ name, conjuncts, bindings }) {
    /** @type {Map<API.Variable, number>} */
    const cells = new Map()
    /** @type {Map<API.Variable, number>} */
    const local = new Map()
    let total = 0

    const assertion = []
    const circuit = new Circuit(bindings)

    // Here we asses each conjunct of the join one by one and identify:
    // 1. Cost associated with each binding. If cost is Infinity it implies
    //    that the variable is required input that must be bound by the rule
    //    application.
    // 2. Cost associated with each local variable. Local variables are the ones
    //    that are not exposed in the rule match and are used by the join.
    // 3. Which bindings are inputs and which are outputs.
    // 4. Which conjuncts are negations as those need to be planned after all
    //    other conjuncts.
    for (const source of conjuncts) {
      const conjunct = circuit.create(source)
      // if (conjunct instanceof Not) {
      //   negation.push(conjunct)
      // } else {
      assertion.push(conjunct)
      // }

      total += conjunct.cost ?? 0

      for (const [variable, cost] of conjunct.cells) {
        circuit.open(variable, conjunct)
        // Only track costs for variables exposed in rule match
        if (bindings.has(variable)) {
          const base = cells.get(variable)
          cells.set(
            variable,
            base === undefined ? cost : combineCosts(base, cost)
          )
        }
        // Local variables contribute to base cost
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

    return new this(circuit.connect(), assertion, cells, total, `${name}`)
  }

  /**
   * @returns {{}[]}
   */
  form() {
    return [...this.assertion.map((conjunct) => conjunct.form())]
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
   * @param {Map<API.Variable, string>} bindings
   */
  ensureBindings(bindings) {
    // Verify all bindings are used
    for (const [variable, id] of bindings) {
      if (!this.cells.has(variable)) {
        throw new ReferenceError(
          `Rule case "${this.name}" does not bind variable ${variable} that rule matches as "${id}"`
        )
      }
    }
    return this
  }

  /**
   * @param {Circuit} circuit
   * @param {Constraint[]} assertion
   * @param {Map<API.Variable, number>} cells
   * @param {number} cost
   * @param {string} name
   */
  constructor(circuit, assertion, cells, cost, name) {
    this.circuit = circuit
    this.assertion = assertion
    this.cells = cells
    this.cost = cost
    this.name = name
  }

  /**
   * @param {Context} context
   * @returns {API.EvaluationPlan}
   */
  plan(context) {
    // We create copy of the context because we will be modifying it as we
    // attempt to figure out execution order.
    const local = scope(context)
    /** @type {Map<API.Variable, Set<typeof this.assertion[0]>>} */
    const blocked = new Map()
    /** @type {Set<typeof this.assertion[0]>} */
    const ready = new Set()
    let cost = 0

    // Initial setup - check which operations are ready vs blocked
    for (const assertion of this.assertion) {
      let requires = 0
      for (const [variable, cost] of assertion.cells) {
        // We resolve the target of the cell as we may have multiple different
        // references to the same variable.
        const reference = resolve(local, variable)
        if (
          cost >= Infinity &&
          !isBound(local, reference)
          // &&
          // If it is _ we don't actually need it perhaps
          // TODO: Evaluate if this is correct ❓
          // reference !== $._
        ) {
          requires++
          const waiting = blocked.get(reference)
          if (waiting) {
            waiting.add(assertion)
          } else {
            blocked.set(reference, new Set([assertion]))
          }
        }
      }

      if (requires === 0) {
        ready.add(assertion)
      }
    }

    const ordered = []
    while (ready.size > 0) {
      let top = null

      // Find lowest cost operation among ready ones
      for (const current of ready) {
        const cost = estimate(current, local)

        if (cost < (top?.cost ?? Infinity)) {
          top = { cost, current }
        }
      }

      if (!top) {
        throw new ReferenceError(
          `Cannot plan ${[...blocked.keys()]} deduction without required cells`
        )
      }

      ordered.push(top.current.plan(context))
      ready.delete(top.current)
      cost += top.cost

      const unblocked = top.current.cells
      // Update local context so all the cells of the planned assertion will
      // be bound.
      for (const [cell] of unblocked) {
        if (!isBound(local, cell)) {
          bind(local, cell, NOTHING)
        }
      }

      // No we attempt to figure out which of the blocked assertions are ready
      // for planning
      for (const [cell] of unblocked) {
        // We resolve a cell to a variable as all blocked operations are tracked
        // by resolved variables because multiple local variable may be bound to
        // same target variable.
        const variable = resolve(local, cell)
        const waiting = blocked.get(variable)
        if (waiting) {
          for (const assertion of waiting) {
            let unblock = true
            // Go over all the cells in this assertion that was blocked on this
            // variable and check if it can be planned now.
            for (const [cell, cost] of assertion.cells) {
              const variable = resolve(local, cell)
              // If cell is required and is still not available, we can't
              // unblock it yet.
              if (cost >= Infinity && !isBound(local, variable)) {
                unblock = false
                break
              }
            }

            if (unblock) {
              ready.add(assertion)
            }
          }
          blocked.delete(variable)
        }
      }
    }

    if (blocked.size > 0) {
      const [[constraint]] = blocked.values()
      for (const [cell, cost] of constraint.cells) {
        if (cost >= Infinity && !isBound(local, cell)) {
          throw new ReferenceError(
            `Unbound ${cell} variable referenced from ${toDebugString(
              constraint
            )}`
          )
        }
      }
    }

    return new JoinPlan(ordered, context.references, cost)
  }

  toJSON() {
    return [...this.assertion]
  }

  toDebugString() {
    const content = [...this.assertion.map(toDebugString)].join(',\n  ')

    return `[${content}]`
  }
}

/**
 * @typedef {Select|FormulaApplication|RuleApplication} Constraint
 */
class Not {
  /**
   * @param {Circuit} circuit
   * @param {API.Constraint} constraint
   * @returns {Not}
   */
  static new(circuit, constraint) {
    const operation = /** @type {Constraint} */ (circuit.create(constraint))

    // Not's cost includes underlying operation
    const cells = new Map()
    for (const [variable, cost] of operation.cells) {
      // Not marks all the cells as required inputs as they
      // need to be bound before not can be evaluated, since it
      // only eliminates matches.
      cells.set(variable, Infinity)
    }

    return new this(circuit, operation, cells)
  }

  /**
   * @returns {{not: {}}}
   */
  form() {
    return {
      not: this.constraint.form(),
    }
  }
  /**
   * @param {Circuit} circuit
   * @param {Constraint} constraint
   * @param {Map<API.Variable, number>} cells
   */
  constructor(circuit, constraint, cells) {
    this.circuit = circuit
    this.constraint = constraint
    this.cells = cells
  }

  get cost() {
    return this.constraint.cost
  }

  /**
   * @param {Context} context
   * @returns {Negate}
   */
  plan(context) {
    return new Negate(this.constraint.plan(context))
  }

  /**
   * @param {API.Variable} by
   */
  address(by) {
    // Return null because we don't want to address by the negation.
    return null
  }

  toDebugString() {
    return `{ not: ${toDebugString(this.constraint)} }`
  }
}

class JoinPlan {
  /**
   * @param {API.EvaluationPlan[]} assertion - Ordered binding operations
   * @param {References} references - Variable references
   * @param {number} cost - Total cost of the plan
   */
  constructor(assertion, references, cost) {
    this.assertion = assertion
    this.references = references
    this.cost = cost
  }

  /**
   * @param {API.EvaluationContext} context
   */
  *evaluate({ source, selection }) {
    // Execute binding steps in planned order
    for (const plan of this.assertion) {
      selection = yield* plan.evaluate({ source, selection })
    }

    return selection
  }

  toJSON() {
    return [...this.assertion.map(toJSON)]
  }

  debug() {
    return [...this.assertion.map(($) => debug($))].join('\n')
  }

  toDebugString() {
    const body = [...this.assertion.map(($) => toDebugString($))]
    return `[${indent(`\n${body.join(',\n')}`)}\n]`
  }
}

class DisjoinPlan {
  /**
   * @param {Record<string, API.EvaluationPlan>} disjuncts
   * @param {number} cost
   */
  constructor(disjuncts, cost) {
    this.disjuncts = disjuncts
    this.cost = cost
  }

  /**
   *
   * @param {API.EvaluationContext} context
   * @returns
   */
  *evaluate({ source, selection }) {
    const matches = []
    // Run each branch and combine results
    for (const plan of Object.values(this.disjuncts)) {
      const bindings = yield* plan.evaluate({ source, selection })
      matches.push(...bindings)
    }
    return matches
  }

  toJSON() {
    return Object.fromEntries(
      Object.entries(this.disjuncts).map(([name, plan]) => [name, toJSON(plan)])
    )
  }
}

/**
 * @template {API.Conclusion} [Match=API.Conclusion]
 */
class DeductivePlan extends DisjoinPlan {
  /**
   * @param {Match} match
   * @param {Record<string, API.EvaluationPlan>} disjuncts
   * @param {number} cost
   */
  constructor(match, disjuncts, cost) {
    super(disjuncts, cost)
    this.match = match
  }
  toJSON() {
    const when = Object.entries(this.disjuncts).map(([name, plan]) => [
      name,
      toJSON(plan),
    ])

    return {
      match: this.match,
      when: when.length === 1 ? when[0][1] : Object.fromEntries(when),
    }
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
        when.push(`  ${name}: ${toDebugString(disjunct)},\n`)
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
      selection: [new Map()],
    })

    return Selector.select(selector, frames)
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

class InductionPlan {
  /**
   * @param {API.EvaluationPlan} base
   * @param {Record<string, API.EvaluationPlan>} disjuncts
   * @param {number} cost
   */
  constructor(base, disjuncts, cost) {
    this.base = base
    this.disjuncts = disjuncts
    this.cost = cost
  }

  /**
   * @param {API.EvaluationContext} context
   * @returns
   */
  *evaluate(context) {
    // First run initial conditions
    let results = yield* this.base.evaluate(context)

    // Then run recursive branches until no new results
    let prevSize = 0
    while (results.length > prevSize) {
      prevSize = results.length
      for (const plan of Object.values(this.disjuncts)) {
        const matches = yield* plan.evaluate({
          ...context,
          selection: results,
        })
        results.push(...matches)
      }
    }

    return results
  }
}

/**
 * @template {API.Conclusion} [Match=API.Conclusion]
 */
class RuleApplicationPlan {
  /**
   * @param {Partial<API.RuleBindings<Match>>} match
   * @param {API.EvaluationPlan} plan
   * @param {Context} context
   */
  constructor(match, plan, context) {
    this.match = match
    this.plan = plan
    this.context = context
  }

  get cost() {
    return this.plan.cost
  }

  /**
   * @param {API.EvaluationContext} context
   */
  *evaluate({ source, selection }) {
    const matches = []
    for (const input of selection) {
      // Copy constant bindings from the application context.
      const bindings = new Map(this.context.bindings)
      // Also copy bindings for the references from the selected match
      // (which is parent context). We need to copy only those in order
      // for the scope isolation e.g. if we copied all or passed match as is
      // some variables in the application body may appear bound even though
      // they should not be.
      for (const [inner, outer] of this.context.references) {
        const value = input.get(outer)
        if (value !== undefined) {
          bindings.set(outer, value)
        }
      }

      // Execute rule with isolated bindings
      const output = yield* this.plan.evaluate({
        source,
        selection: [bindings],
      })

      // Now we need to merge original `input` and data that is shared from
      // the `output`.
      for (const out of output) {
        const match = new Map(input)
        // Copy bindings that were derived by the rule application.
        for (const [inner, outer] of this.context.references) {
          const value = out.get(outer)
          if (value !== undefined) {
            match.set(outer, value)
          }
        }

        // Copy constant bindings from the application context.
        for (const [variable, value] of this.context.bindings) {
          match.set(variable, value)
        }

        matches.push(match)
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
      selection: [new Map()],
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
 * @param {Context} [context]
 */
const estimate = ({ cells, cost = 0 }, context) => {
  let total = cost
  for (const [variable, cost] of cells) {
    if (context && !isBound(context, variable)) {
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

class Negate {
  /**
   * @param {API.EvaluationPlan} operand
   */
  constructor(operand) {
    this.operand = operand
  }

  get cost() {
    return this.operand.cost
  }

  /**
   * @param {API.EvaluationContext} context
   */
  *evaluate({ source, selection }) {
    const matches = []
    for (const bindings of selection) {
      const excluded = yield* this.operand.evaluate({
        source,
        selection: [bindings],
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
}

export const NOTHING = Link.of({ '/': 'bafkqaaa' })
export const ROUTE_TARGET = Link.of({ '?': NOTHING })

/**
 * Connections represent some query expression containing a variable by which we
 * track a dependency. However, from the circuit perspective don't really care
 * about the expression itself, we just need a way to tokenize it in a way that
 * will allow us to derive a deterministic identifier. For this reason
 * connection simply needs to provide a method for iterating it's tokens. When
 * token is a variable it will be resolved to a trace to port in the circuit
 * allowing us to derive unique identifier for it.
 *
 * @typedef {object} Connection
 * @property {(cell: API.Variable) => Route|null} address
 */

/**
 * Representation of the query as circuit of connections between logic variables
 * that underlying expressions use. It for dependency tracking and cycle
 * analysis. It is also used for assigning deterministic identifiers to the the
 * local variables which are in some ways derived from the ports of the circuit.
 */
class Circuit {
  static new() {
    return new this(new Map())
  }
  /**
   * Set of ports that this circuit can be connected to the outside world.
   * Keys of the map are variables / cells representing ports while values are
   * names assigned to them which usually correspond to the names in the rule's
   * match clause.
   *
   * @param {Map<API.Variable, string>} ports
   */
  constructor(ports) {
    /**
     * Map is used to collect list of trace candidates for the cells. When we
     * call connect we will try to resolve the shortest trace for each cell and
     * migrate cell from `open` to `ready`.
     *
     * @type {Map<API.Variable, Set<Connection>>}
     */
    this.opened = new Map()

    /**
     * Map of cell traces, representing a shortest serializable path to the
     * circuit port.
     *
     * @type {Map<API.Variable, Route|PortRoute>}
     */
    this.ready = new Map()

    /**
     * We create a traces for each port circuit port, so that we don't have to
     * differentiate between circuit ports and cells that are connected.
     */
    for (const [port, id] of ports) {
      this.ready.set(port, { port: id, distance: 0 })
    }

    // Special handling for discard variable - always consider it connected
    this.ready.set($._, { port: '_', distance: 0 })
  }

  /**
   * This is used to simply capture a connection between a cell and expression
   * it appears in. This is used to add connection to possible trace candidates
   * for the cell.
   *
   * @param {API.Variable} port
   * @param {Connection} connection
   */
  open(port, connection) {
    // If port is already connected we skip this connection as we already have
    // an established trace for it. Otherwise we add connection to the list of
    // trace candidates.
    if (!this.ready.has(port)) {
      const connections = this.opened.get(port)
      if (connections) {
        connections.add(connection)
      } else {
        this.opened.set(port, new Set([connection]))
      }
    }
  }

  /**
   * Connect method is used to resolve every cell traces in the circuit. If some
   * cell trace can not be resolved it means that underlying expression is not
   * connected to the circuit which indicates potential error in the query as
   * some variable in it is either redundant or some expression connecting it to
   * the circuit is missing.
   */
  connect() {
    const { ready, opened } = this
    let size = -1

    // Keep attempting to resolving traces until we reach a fixed point and are
    // unable to make any more progress.
    while (size !== ready.size) {
      size = ready.size
      for (const [cell, connections] of opened) {
        // We should not encounter a port in the ready list if it appears in the
        // opened list, however we still check just in case.
        if (!ready.has(cell)) {
          const route = connect(cell, connections)

          // If we managed to resolve a trace for this cell we add it to the
          // ready set and remove it from the open set.
          if (route) {
            opened.delete(cell)
            ready.set(cell, route)
          }
        }
      }
    }

    // If we have reached a fixed point but still have cells that are not
    // connected we have a bad circuit and we need to raise an error.
    if (opened.size > 0) {
      const reasons = []
      for (const [port, connections] of opened) {
        for (const connection of connections) {
          reasons.push(
            `Reference ${Variable.toDebugString(port)} in ${toDebugString(
              connection
            )}`
          )
        }
      }

      throw new ReferenceError(
        reasons.length === 1 ?
          `Unable to resolve ${reasons[0]}`
        : `Unable to resolve:${indent(`\n${reasons.map(li).join('\n')}`)}`
      )
    }

    return this
  }

  /**
   * @param {API.Conjunct} source
   */
  create(source) {
    if (source.not) {
      return Not.new(this, source.not)
    } else if (source.rule) {
      return RuleApplication.new(this, source)
    } else if (source.operator) {
      return FormulaApplication.new(this, source)
    } else {
      return Select.new(this, source)
    }
  }

  /**
   *
   * @param {API.Term} term
   */
  resolve(term) {
    if (Variable.is(term)) {
      return this.ready.get(term)
    } else {
      return term
    }
  }

  /**
   * @param {API.Variable} cell
   * @returns {Route|null}
   */
  address(cell) {
    return /** @type {any} */ (this.ready.get(cell))
  }
}

/**
 * Attempts to establish a trace from a given cell to one of the `ready`
 * connections by considering each of the candidate connections. When multiple
 * traces can be resolved they are compared to pick the winner. The winner is
 * usually the shortest trace, but sometimes there could be traces with the same
 * frame count in which case frames are compared to determine the winner.
 *
 * @param {API.Variable} cell
 * @param {Set<Connection>} connections
 */
const connect = (cell, connections) => {
  /** @type {Route|null} */
  let route = null
  // Consider each candidate connection, to see if all of their dependency cells
  // are already resolved. Note that if dependency can not be resolved it
  // implies that corresponding trace will be longer than the one for which
  // all dependencies can be resolved so we can pick the winner without having
  // to resolve such a trace.
  for (const connection of connections) {
    const candidate = connection.address(cell)

    // We choose between previously found trace and this candidate trace based
    // on which sorts lower.
    if (candidate) {
      route =
        route == null || compareRoutes(route, candidate) > 0 ? candidate : route
    }
  }

  // We return a trace if we were able to resolve one, otherwise we return null
  // to indicate that trace can not be resolved yet.
  return route
}

/**
 * @param {Route} base
 * @param {Route} candidate
 * @returns {-1|0|1}
 */
const compareRoutes = (base, candidate) => {
  if (base.distance < candidate.distance) {
    return -1
  } else if (candidate.distance < base.distance) {
    return 1
  } else if ('port' in base) {
    if ('port' in candidate) {
      return /** @type {-1|0|1} */ (base.port.localeCompare(candidate.port))
    } else {
      return -1
    }
  } else if ('fact' in base) {
    if ('fact' in candidate) {
      let delta = compareRouteMember(base.match.the, candidate.match.the)
      if (delta !== 0) {
        return delta
      }
      delta = compareRouteMember(base.match.of, candidate.match.of)
      if (delta !== 0) {
        return delta
      }
      return compareRouteMember(base.match.is, candidate.match.is)
    } else {
      return 'port' in candidate ? 1 : -1
    }
  } else if ('operator' in base) {
    if ('operator' in candidate) {
      let delta = compareMatch(base.match, candidate.match)
      if (delta !== 0) {
        return delta
      }
      return /** @type {-1|0|1} */ (
        base.operator.localeCompare(candidate.operator)
      )
    } else {
      return (
        'port' in candidate ? 1
        : 'fact' in candidate ? 1
        : -1
      )
    }
  } else if ('rule' in base) {
    if ('rule' in candidate) {
      let delta = compareMatch(base.match, candidate.match)
      if (delta !== 0) {
        return delta
      }

      return /** @type {-1|0|1} */ (
        JSON.stringify(base.rule).localeCompare(JSON.stringify(candidate.rule))
      )
    } else {
      return 1
    }
  } else {
    throw new RangeError('Unknown route type')
  }
}

/**
 *
 * @param {Record<string, API.Scalar|Route>} base
 * @param {Record<string, API.Scalar|Route>} candidate
 * @returns {-1|0|1}
 */
const compareMatch = (base, candidate) => {
  let keys = new Set([...Object.keys(base), ...Object.keys(candidate)])
  for (const key of keys) {
    const delta = compareRouteMember(base[key], candidate[key])
    if (delta !== 0) {
      return delta
    }
  }
  return 0
}

/**
 *
 * @param {Route|API.Scalar|undefined} base
 * @param {Route|API.Scalar|undefined} candidate
 * @returns {-1|0|1}
 */
const compareRouteMember = (base = NOTHING, candidate = NOTHING) => {
  if (Constant.is(base)) {
    if (Constant.is(candidate)) {
      return Constant.compare(base, candidate)
    } else {
      return -1
    }
  } else if (Constant.is(candidate)) {
    return 1
  } else {
    return compareRoutes(base, candidate)
  }
}

/**
 * @typedef {{port: string, distance: 0}} PortRoute
 * @typedef {{match: Record<string, API.Scalar|Route>, fact:{}, distance: number}} SelectRoute
 * @typedef {{match: Record<string, API.Scalar|Route>, operator:string, distance: number}} FormulaRoute
 * @typedef {{match: Record<string, API.Scalar|Route>, rule:{}, distance:number}} RuleRoute
 * @typedef {SelectRoute|FormulaRoute|RuleRoute|PortRoute} Route
 */

/**
 *
 * @param {any} source
 * @returns
 */

export const debug = (source) => {
  return source.debug ? source.debug() : JSON.stringify(source, null, 2)
}

/**
 * Represents a local variable references to a remote variables. This is n:1
 * relation meaning multiple local variables may point to the same remote one
 * but local variable can point to at most one remote variable.
 *
 * @typedef {Map<API.Variable, API.Variable>} References
 */

/**
 * Represents set of bound variables.
 * @typedef {Map<API.Variable, API.Scalar>} Frame
 */

/**
 * @typedef {object} Context
 * @property {Map<API.Variable, API.Variable>} references
 * @property {Map<API.Variable, API.Scalar>} bindings
 */

/**
 * Returns true if the variable is bound in this context.
 *
 * @param {Context} context
 * @param {API.Variable} variable
 */
const isBound = (context, variable) => {
  return context.bindings.has(resolve(context, variable))
}

/**
 *
 * @param {Context} context
 * @param {API.Variable} variable
 * @param {API.Scalar} value
 */
const bind = (context, variable, value) =>
  write(context, variable, value, context.bindings)

/**
 * @param {Context} context
 * @param {API.Variable} variable
 * @param {API.Scalar} value
 * @param {API.MatchFrame} scope
 */
const write = (context, variable, value, scope) => {
  // We ignore assignments to `_` because that is discard variable.
  if (variable !== _) {
    const reference = resolve(context, variable)
    const current = scope.get(reference)
    if (current === undefined) {
      scope.set(reference, value)
    } else if (!Constant.equal(current, value)) {
      throw new RangeError(
        `Can not bind ${Variable.toDebugString(
          variable
        )} to ${Constant.toDebugString(
          value
        )} because it is already bound to ${Constant.toDebugString(current)}`
      )
    }
  }
}

/**
 *
 * @param {Context} context
 * @param {API.Variable} variable
 * @param {API.MatchFrame} scope
 */
export const read = (context, variable, scope) =>
  scope.get(resolve(context, variable))

/**
 *
 * @param {Context} context
 * @param {API.Term} term
 * @param {API.Scalar} value
 * @param {API.MatchFrame} scope
 */
const merge = (context, term, value, scope) => {
  if (Variable.is(term)) {
    write(context, term, value, scope)
  } else if (!Constant.equal(term, value)) {
    throw new RangeError(
      `Can not unify ${Constant.toDebugString(
        term
      )} with ${Constant.toDebugString(value)}`
    )
  }
}

/**
 *
 * @param {Context} context
 * @param {API.Term} term
 * @param {API.MatchFrame} scope
 */
export const lookup = (context, term, scope) =>
  Variable.is(term) ? read(context, term, scope) : term

/**
 * Attempts to resolve the variable in this context. If variable is a reference
 * it will return the variable it refers to, otherwise it will return this
 * variable essentially treating it as local.
 *
 * @param {Context} context
 * @param {API.Variable} variable
 */
const resolve = (context, variable) =>
  context.references.get(variable) ?? variable

/**
 * Returns the value of the variable in this context.
 * @param {Context} context
 * @param {API.Variable} variable
 * @returns {API.Scalar|undefined}
 */
const get = (context, variable) => read(context, variable, context.bindings)

/**
 *
 * @param {Context} context
 * @param {API.Variable} local
 * @param {API.Variable} remote
 */
const redirect = (context, local, remote) => {
  context.references.set(local, remote)
}
/**
 *
 * @param {Context} context
 */
const scope = (context) => {
  return new ContextView(context.references, new Map(context.bindings))
}

class ContextView {
  static free = new ContextView(
    Object.freeze(new Map()),
    Object.freeze(new Map())
  )

  /**
   * @param {References} references
   * @param {Frame} frame
   */
  static new(references = new Map(), frame = new Map()) {
    return new this(references, frame)
  }
  /**
   * @param {References} references
   * @param {Frame} bindings
   */
  constructor(references, bindings) {
    this.references = references
    this.bindings = bindings
  }

  /**
   * @param {API.Variable} variable
   */
  resolve(variable) {
    return resolve(this, variable)
  }

  /**
   * @param {API.Variable} variable
   * @returns {API.Scalar|undefined}
   */
  get(variable) {
    return get(this, variable)
  }

  /**
   * @param {API.Variable} variable
   * @returns {boolean}
   */
  has(variable) {
    return isBound(this, variable)
  }
}
