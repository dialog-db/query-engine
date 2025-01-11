import * as API from './api.js'
import * as Variable from './variable.js'
import * as Terms from './terms.js'
import * as Bindings from './bindings.js'
import * as Term from './term.js'
import { Constant, Link, matchFact, Var, $ } from './lib.js'
import * as Formula from './formula.js'
import * as Selector from './selector.js'

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
export const rule = (source) => DeductiveRule.new(Circuit.new(), source)

/**
 * @template {API.Conclusion} Match
 * @template {Match} Repeat
 * @param {API.Induction<Match, Repeat>} source
 */
export const loop = (source) => InductiveRule.new(Circuit.new(), source)

/**
 * @template {API.Conclusion} Match
 * @param {API.RuleApplication<Match>} application
 */
export const plan = (application) =>
  RuleApplication.new(Circuit.new(), application).plan()

/**
 * @typedef {object} Scope
 * @property {Map<API.Variable, string>} provided
 * @property {Map<API.Variable, Select[]>} dependencies
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
   */
  constructor(circuit, selector, cells) {
    this.circuit = circuit
    this.cells = cells
    this.selector = selector
  }

  *tokens() {
    const { the, of, is } = this.selector
    if (the != null) {
      yield the
    }
    if (of != null) {
      yield of
    }

    if (is != null) {
      yield is
    }
  }

  /**
   * Base execution cost of the select operation.
   */
  get cost() {
    return 100
  }

  plan() {
    return this
  }

  /**
   *
   * @param {API.EvaluationContext} context
   */
  *evaluate({ source, selection }) {
    const matches = []
    const { selector } = this
    for (const bindings of selection) {
      const the =
        selector.the ?
          Bindings.get(bindings, selector.the) ?? selector.the
        : undefined

      const of =
        selector.of ?
          Bindings.get(bindings, selector.of) ?? selector.of
        : undefined

      const is =
        selector.is ?
          Bindings.get(bindings, selector.is) ?? selector.is
        : undefined

      // Note: We expect that there will be LRUCache wrapping the db
      // so calling scan over and over again will not actually cause new scans.
      const facts = yield* source.scan({
        entity: Variable.is(of) ? undefined : of,
        attribute: Variable.is(the) ? undefined : the,
        value: Variable.is(is) ? undefined : is,
      })

      for (const [entity, attribute, value] of facts) {
        /** @type {API.Result<API.Bindings, Error>} */
        let result = { ok: bindings }
        if (result.ok && of !== undefined) {
          result = Term.match(of, entity, bindings)
        }

        if (result.ok && the !== undefined) {
          result = Term.match(the, attribute, result.ok)
        }

        if (result.ok && is !== undefined) {
          result = Term.match(is, value, result.ok)
        }

        if (result.ok) {
          matches.push(result.ok)
        }
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
  debug() {
    const { circuit, selector } = this
    const { the, of, is } = selector
    const parts = []
    if (the !== undefined) {
      parts.push(`the: ${circuit.resolve(the)}`)
    }

    if (of !== undefined) {
      parts.push(`of: ${circuit.resolve(of)}`)
    }

    if (is !== undefined) {
      parts.push(`is: ${circuit.resolve(is)}`)
    }

    return `{ match: {${parts.join(' ')}} }`
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
   * @returns {Iterable<API.Term>}
   */
  *tokens() {
    yield 'match'

    if (Term.is(this.from)) {
      yield 'of'
      yield this.from
    } else {
      for (const [key, term] of Object.entries(this.from)) {
        yield key
        yield term
      }
    }

    if (Term.is(this.to)) {
      yield 'is'
      yield this.to
    } else {
      for (const [key, term] of Object.entries(this.to)) {
        yield key
        yield term
      }
    }

    yield 'operator'
    yield this.source.operator
  }
  /**
   * @param {Circuit} circuit
   * @param {API.SystemOperator} source
   * @param {Map<API.Variable, number>} cells
   * @param {Record<string, API.Term>|API.Term} from
   * @param {Record<string, API.Term>} to
   */
  constructor(circuit, source, cells, from, to) {
    this.circuit = circuit
    this.cells = cells
    this.source = source
    this.from = from
    this.to = to
  }
  /**
   * Base execution cost of the formula application operation.
   */
  get cost() {
    return 5
  }

  plan() {
    return this
  }

  /**
   * @param {API.EvaluationContext} context
   */
  *evaluate(context) {
    const { from, to, source } = this
    const operator =
      /** @type {(input: API.Operand) => Iterable<API.Operand>} */
      (source.formula ?? Formula.operators[this.source.operator])

    const matches = []
    next: for (const frame of context.selection) {
      const input = Formula.resolve(from, frame)
      for (const output of operator(input)) {
        // If function returns single output we treat it as { is: output }
        // because is will be a cell in the formula application.
        const out = Constant.is(output) ? { is: output } : output
        const terms = Object.entries(to)
        if (terms.length === 0) {
          matches.push(frame)
        } else {
          const extension = /** @type {Record<string, API.Scalar>} */ (out)
          let bindings = frame
          for (const [key, term] of terms) {
            const match = Term.unify(extension[key], term, frame)
            if (match.ok) {
              bindings = match.ok
            } else {
              continue next
            }
          }
          matches.push(bindings)
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
class RuleApplication {
  /**
   * @template {API.Conclusion} Match
   * @param {DeductiveRule<Match>|InductiveRule<Match>} rule
   * @param {API.RuleBindings<Match>} terms
   */
  static apply(rule, terms) {
    const application = new this(terms, rule, new Map(), new Map())
    const { mapping, cells } = application

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
        rule.circuit.open(term, application)
      }

      if (term !== undefined) {
        mapping.set(inner, term)
      }
    }

    return application
  }
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
        InductiveRule.new(circuit, source.rule)
      : DeductiveRule.new(circuit, source.rule)

    return this.apply(rule, source.match)
  }

  /**
   * @param {API.RuleBindings<Match>} match
   * @param {DeductiveRule<Match>|InductiveRule<Match>} rule
   * @param {Map<API.Variable, API.Term>} mapping
   * @param {Map<API.Variable, number>} cells
   */
  constructor(match, rule, mapping, cells) {
    this.match = match
    this.rule = rule
    this.mapping = mapping
    this.cells = cells
  }
  get cost() {
    return this.rule.cost
  }

  /**
   * @param {Context} context
   */
  plan(context = ContextView.new()) {
    // Convert outer bindings to rule's internal variables
    const local = scope(context)
    for (const [inner, outer] of this.mapping) {
      // If provided term is not a variable we bind value in local context. If
      // it is a variable we create a reference from local variable to the outer
      // variable.
      if (!Variable.is(outer)) {
        bind(local, inner, outer)
      } else {
        createReference(local, inner, outer)
      }
    }

    return new RuleApplicationPlan(
      this.match,
      this.rule.plan(local),
      this.mapping
    )
  }

  *tokens() {
    yield 'match'
    for (const [key, term] of Object.entries(this.match)) {
      yield `:${key}`
      yield term
    }
  }

  /**
   * @param {object} input
   * @param {API.Querier} input.source
   */
  query(input) {
    return this.plan().query(input)
  }

  toDebugString() {
    const { match, rule } = this
    return `{ match: ${Terms.toDebugString(match)}, rule: ${toDebugString(
      rule
    )} }`
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
class DeductiveRule {
  /**
   * @param {Circuit} circuit
   * @template {API.Conclusion} Case
   * @param {API.Deduction<Case>} source
   */
  static new(circuit, source) {
    const disjuncts =
      Array.isArray(source.when) ? { when: source.when } : source.when ?? {}

    // Create rule instance first
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

    return new this(circuit, source.match, cells, total, when)
  }

  /**
   * @param {Circuit} circuit
   * @param {Match} match - Pattern to match against
   * @param {Map<API.Variable, number>} cells - Cost per variable when not bound
   * @param {number} cost - Base execution cost
   * @param {Record<string, Join>} when - Named deductive branches that must be evaluated
   */
  constructor(circuit, match, cells, cost, when) {
    this.circuit = circuit
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
   * @param {API.RuleBindings<Match>} terms
   * @returns {RuleApplication<Match>}
   */
  apply(terms) {
    return RuleApplication.apply(this, terms)
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
      for (const [variable, cost] of this.cells) {
        if (cost >= Infinity && !isBound(context, variable)) {
          throw new Error(
            `Rule application omits required binding for "${variable}" variable`
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
}

/**
 * @template {API.Conclusion} [Match=API.Conclusion]
 * @template {Match} [Repeat=Match]
 * @implements {API.Induction<Match, Repeat>}
 */
class InductiveRule {
  /**
   * @template {API.Conclusion} Match
   * @param {Circuit} circuit
   * @template {Match} [Repeat=Match]
   * @param {API.Induction<Match, Repeat>} source
   */
  static new(circuit, source) {
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

    return new this(
      circuit,
      source.match,
      when,
      source.repeat,
      induction,
      cells,
      total
    )
  }

  /**
   * @param {Circuit} circuit
   * @param {Match} match - Initial pattern to match
   * @param {Join} when - Initial conditions that must be met
   * @param {Repeat} repeat - Pattern to match in recursive iterations
   * @param {Record<string, Join>} loop - Named branches for recursive conditions
   * @param {Map<API.Variable, number>} cells - Cost per variable when not bound
   * @param {number} cost - Base cost including initial conditions and exponentially weighted recursive costs.
   */
  constructor(circuit, match, when, repeat, loop, cells, cost) {
    this.circuit = circuit
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
    return RuleApplication.apply(this, terms)
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
}

const EMPTY_SET = Object.freeze(new Set())

const nothing = Link.of(null)

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
    const cells = new Map()
    const internal = new Map()
    const dependencies = new Map()
    let total = 0

    let inputs = new Set()
    let outputs = new Set()
    const assertion = []
    const negation = []
    const circuit = new Circuit(bindings)

    for (const source of conjuncts) {
      const conjunct = circuit.create(source)
      if (conjunct instanceof Not) {
        negation.push(conjunct)
      } else {
        assertion.push(conjunct)
      }

      total += conjunct.cost ?? 0

      for (const [variable, cost] of conjunct.cells) {
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
          const base = internal.get(variable)
          internal.set(
            variable,
            base === undefined ? cost : combineCosts(base, cost)
          )
        }

        if (cost < Infinity) {
          outputs.add(variable)
        } else {
          inputs.add(variable)
        }
      }

      // Capture dependencies so we can check for cycles
      for (const variable of outputs) {
        const requirements = dependencies.get(variable)
        if (requirements == null) {
          dependencies.set(variable, new Set(inputs))
        } else {
          for (const input of inputs) {
            requirements.add(input)
          }
        }
      }
      outputs.clear()
      inputs.clear()
    }

    for (const cost of Object.values(internal)) {
      total += cost
    }

    // Check for unresolvable cycles
    for (const cycle of findUnresolvableCycle(dependencies)) {
      throw new ReferenceError(
        `Unresolvable circular dependency in clause: ${cycle.join(' -> ')}`
      )
    }

    circuit.connect()

    return new this(assertion, negation, cells, total, `${name}`)
  }

  /**
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
   * @param {Constraint[]} assertion
   * @param {Not[]} negation
   * @param {Map<API.Variable, number>} cells
   * @param {number} cost
   * @param {string} name
   */
  constructor(assertion, negation, cells, cost, name) {
    this.assertion = assertion
    this.negation = negation
    this.cells = cells
    this.cost = cost
    this.name = name
  }

  /**
   * @param {Context} context
   * @returns {API.EvaluationPlan}
   */
  plan(context) {
    const local = scope(context)
    /** @type {Map<API.Variable, Set<typeof this.assertion[0]>>} */
    const blocked = new Map()
    /** @type {Set<typeof this.assertion[0]>} */
    const ready = new Set()
    let cost = 0

    // Initial setup - check which operations are ready vs blocked
    for (const assertion of this.assertion) {
      let requires = 0
      for (const [cell, cost] of assertion.cells) {
        // We resolve the target of the cell as we may have multiple different
        // references to the same variable.
        const variable = resolve(local, cell)
        if (cost >= Infinity && !isBound(local, variable)) {
          requires++
          const waiting = blocked.get(variable)
          if (waiting) {
            waiting.add(assertion)
          } else {
            blocked.set(variable, new Set([assertion]))
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
          `Cannot plan ${blocked.keys()} deduction without required cells`
        )
      }

      ordered.push(top.current.plan(local))
      ready.delete(top.current)
      cost += top.cost

      const unblocked = top.current.cells
      // Update local context so all the cells of the planned assertion will
      // be bound.
      for (const [cell] of unblocked) {
        bind(local, cell, nothing)
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
            // Go over all the cells in thi assertion that was blocked on this
            // variable and check it can be planned now.
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

    return new JoinPlan(
      ordered,
      this.negation.map((negation) => negation.plan(local)),
      cost
    )
  }

  toJSON() {
    return [...this.assertion, ...this.negation]
  }

  toDebugString() {
    const content = [
      ...this.assertion.map(toDebugString),
      ...this.negation.map(toDebugString),
    ].join(',\n  ')

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
    const operation = /** @type {Constraint} */ (
      Circuit.new().create(constraint)
    )

    // Not's cost includes underlying operation
    const cells = new Map()
    for (const [variable, cost] of operation.cells) {
      // Not has no output but all the inputs must be bound before it can be
      // evaluated.
      if (cost > 0) {
        cells.set(variable, cost)
      }
    }

    return new this(circuit, operation, cells)
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
}

class JoinPlan {
  /**
   * @param {API.EvaluationPlan[]} assertion - Ordered binding operations
   * @param {API.EvaluationPlan[]} negation - Negation operations to run after
   * @param {number} cost - Total cost of the plan
   */
  constructor(assertion, negation, cost) {
    this.assertion = assertion
    this.negation = negation
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

    // Then execute negation steps
    for (const plan of this.negation) {
      selection = yield* plan.evaluate({ source, selection })
    }

    return selection
  }

  toJSON() {
    return [...this.assertion.map(toJSON), ...this.negation.map(toJSON)]
  }

  debug() {
    return [
      ...this.assertion.map(($) => debug($)),
      ...this.negation.map(($) => debug($)),
    ].join('\n')
  }

  toDebugString() {
    const body = [
      ...this.assertion.map(($) => toDebugString($)),
      ...this.negation.map(($) => toDebugString($)),
    ]
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
      selection: [{}],
    })

    return Selector.select(selector, frames)
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
   * @param {API.RuleBindings<Match>} match
   * @param {API.EvaluationPlan} plan
   * @param {Map<API.Variable, API.Term>} mapping - inner -> outer variable mapping
   */
  constructor(match, plan, mapping) {
    this.match = match
    this.plan = plan
    this.mapping = mapping
  }

  get cost() {
    return this.plan.cost
  }

  /**
   * @param {API.EvaluationContext} context
   */
  *evaluate({ source, selection }) {
    const matches = []
    next: for (const bindings of selection) {
      /** @type {API.Bindings} */
      let match = {}
      for (const [inner, outer] of this.mapping) {
        const value = Bindings.get(bindings, outer)
        if (value !== undefined) {
          const result = Term.unify(inner, value, match)
          if (result.error) {
            continue next
          } else {
            match = result.ok
          }
        }
      }

      // Execute rule with isolated bindings
      const results = yield* this.plan.evaluate({
        source,
        selection: [match],
      })

      // For each result, create new outer bindings with mapped values
      for (const result of results) {
        let output = { ...bindings }
        for (const [inner, outer] of this.mapping) {
          const value = Bindings.get(result, inner)
          if (Variable.is(outer) && value !== undefined) {
            output = Bindings.set(output, outer, value)
          }
        }
        matches.push(output)
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
   * @param {API.Querier} input.source
   */
  *query({ source }) {
    const { match: selector } = this

    const frames = yield* this.evaluate({
      source,
      selection: [{}],
    })

    return Selector.select(selector, frames)
  }

  toDebugString() {
    const { match, plan } = this

    return indent(`{
  match: ${indent(Terms.toDebugString(match))},
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

/**
 * Find cycles in the variable dependency graph using an iterative approach
 *
 * @param {Map<API.VariableID, Set<API.VariableID>>} graph
 * @returns {Generator<API.VariableID[], void>}
 */
function* findCycles(graph) {
  /** @type {Set<API.VariableID>} */
  const visited = new Set()
  /** @type {Set<API.VariableID>} */
  const path = new Set()

  /**
   * @typedef {{
   *   node: API.VariableID,
   *   path: API.VariableID[],
   *   requires: Iterator<API.VariableID>
   * }} StackFrame
   */

  for (const start of graph.keys()) {
    if (visited.has(start)) {
      continue
    }

    /** @type {StackFrame[]} */
    const stack = [
      {
        node: start,
        path: [start],
        requires: (graph.get(start) ?? new Set()).values(),
      },
    ]

    path.add(start)

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      const next = frame.requires.next()
      if (next.done) {
        path.delete(frame.node)
        stack.pop()
        continue
      }

      const dependency = next.value
      if (path.has(dependency)) {
        const cycleStart = frame.path.indexOf(dependency)
        if (cycleStart !== -1) {
          yield frame.path.slice(cycleStart)
        }
        continue
      }

      if (!visited.has(dependency)) {
        path.add(dependency)
        stack.push({
          node: dependency,
          path: [...frame.path, dependency],
          requires: (graph.get(dependency) ?? new Set()).values(),
        })
      }
    }

    for (const node of path) {
      visited.add(node)
    }
    path.clear()
  }
}

/**
 * Finds unresolvable cycles in the dependency graph.
 * A cycle is unresolvable if every variable in it depends on another variable in the cycle.
 *
 * @param {Map<API.VariableID, Set<API.VariableID>>} dependencies
 * @returns {Iterable<API.VariableID[]>}
 */
function* findUnresolvableCycle(dependencies) {
  for (const cycle of findCycles(dependencies)) {
    let hasIndependentVar = false

    for (const id of cycle) {
      const path = dependencies.get(id)
      if (!path) {
        hasIndependentVar = true
        break
      }

      // Check if this variable depends on any cycle variable
      let dependsOnCycle = false
      for (const entry of path) {
        if (cycle.includes(entry)) {
          dependsOnCycle = true
          break
        }
      }

      if (!dependsOnCycle) {
        hasIndependentVar = true
        break
      }
    }

    if (!hasIndependentVar) {
      yield cycle
    }
  }
}

const THIS = '@'

/**
 * @typedef {object} Connection
 * @property {() => Iterable<API.Term>} tokens
 */

class Circuit {
  static new() {
    return new this(new Map())
  }
  /**
   * @param {Map<API.Variable, string>} ports
   */
  constructor(ports) {
    /** @type {Map<API.Variable, [Connection, ...Connection[]]>} */
    this.opened = new Map()

    /** @type {Map<API.Variable, Trace>} */
    this.ready = new Map()
    for (const [port, id] of ports) {
      this.ready.set(port, new Trace().add(id))
    }
  }

  /**
   * @param {API.Variable} port
   * @param {Connection} connection
   */
  open(port, connection) {
    // Skip if variable is provided in scope
    if (!this.ready.has(port)) {
      const connections = this.opened.get(port)
      if (connections) {
        connections.push(connection)
      } else {
        this.opened.set(port, [connection])
      }
    }
  }

  connect() {
    const { ready, opened } = this
    let size = -1

    // Keep resolving until we reach a fixed point and are unable to compile any
    // more connections
    while (size !== ready.size) {
      size = ready.size
      for (const [port, connections] of opened) {
        if (!ready.has(port)) {
          const connection = connect(port, connections, ready)

          // If we managed to compile a connection remove it from the open list
          // and add it to the ready list.
          if (connection != null) {
            opened.delete(port)
            ready.set(port, connection)
          }
        }
      }
    }

    if (opened.size > 0) {
      const reasons = []
      for (const [port, connections] of opened) {
        const unresolved = []
        for (const connection of connections) {
          unresolved.push(toDebugString(connection))
        }
        reasons.push(`${port} with connections: ${unresolved.join('\n  - ')}`)
      }

      throw new ReferenceError(
        reasons.length === 1 ?
          `Unable to resolve ${reasons[0]}`
        : `Unable to resolve:\n  ${reasons.join('\n')}`
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
}

/**
 * @param {API.Variable} cell
 * @param {[Connection, ...Connection[]]} connections
 * @param {Map<API.Variable, Trace>} build
 */
const connect = (cell, connections, build) => {
  /** @type {Trace|null} */
  let trace = null
  // For each connection, check if all its dependencies are ready
  for (const connection of connections) {
    const candidate = new Trace()
    for (const token of connection.tokens()) {
      // If this the variable that we are trying to compile we denote
      // it with `THIS`.
      if (cell === token) {
        candidate.add(THIS)
      } else if (Variable.is(token)) {
        // If we already have a resolved id for this cell we use it
        // otherwise we continue to the next connection.
        const frame = build.get(token)
        if (frame !== undefined) {
          candidate.add(frame)
        }
        // If we can do not have a frame for this variable we can't connect
        // this connection yet, but that means there is a variable that could
        // not be resolved yet. We will try another connection if some can be
        // connected they will be shorter traces and that is the one we pick
        // anyway.
        else {
          break
        }
      } else {
        candidate.add(token)
      }
    }

    // Choose between the current and the candidate traces based on which is
    // shorter
    trace =
      trace == null || Trace.compare(trace, candidate) > 0 ? candidate : trace
  }

  return trace
}

class Trace {
  /**
   * @param {number} size
   */
  constructor(size = 1) {
    this.size = size
    /**
     * @type {Array<API.Scalar>}
     */
    this.frames = []
  }
  /**
   * @param {API.Scalar|Trace} frame
   */
  add(frame) {
    if (frame instanceof Trace) {
      this.size += frame.size
      if (frame.frames.length > 1) {
        this.frames.push('(', ...frame.frames, ')')
      } else {
        this.frames.push(...frame.frames)
      }
    } else {
      this.frames.push(frame)
    }
    return this
  }

  get [Symbol.toStringTag]() {
    const parts = []
    for (const frame of this.frames) {
      parts.push(String(frame))
    }
    return parts.length === 1 ? parts[0] : `(${parts.join(' ')})`
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }

  /**
   * @returns {IterableIterator<API.Scalar>}
   */
  *tokens() {
    for (const frame of this.frames) {
      if (frame instanceof Trace) {
        yield* frame.tokens()
      } else {
        yield frame
      }
    }
  }

  /**
   *
   * @returns {string}
   */
  toString() {
    const parts = []
    for (const frame of this.frames) {
      if (frame instanceof Trace) {
        parts.push(frame.toString())
      } else {
        parts.push(String(frame))
      }
    }
    return parts.length > 1 ? `(${parts.join(' ')})` : parts[0]
  }

  /**
   * @param {Trace} leader
   * @param {Trace} candidate
   */
  static compare(leader, candidate) {
    if (leader.size < candidate.size) {
      return -1
    } else if (candidate.size < leader.size) {
      return 1
    } else {
      const leaderTokens = leader.tokens()
      const candidateTokens = candidate.tokens()
      while (true) {
        const { value: leaderToken, done: lead } = leaderTokens.next()
        const { value: candidateToken, done: exit } = candidateTokens.next()
        if (lead && exit) {
          return 0
        } else if (!lead) {
          return -1
        } else if (!exit) {
          return 1
        }

        const delta = Constant.compare(leaderToken, candidateToken)
        if (delta !== 0) {
          return delta
        }
      }
    }
  }
}

/**
 * @param {string} message
 */
export const indent = (message, indent = '  ') =>
  `${message.split('\n').join(`\n${indent}`)}`

/**
 * @param {string} message
 */
export const li = (message) => indent(`- ${message}`)

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
 * @property {References} references
 * @property {Frame} frame
 */

/**
 * Returns true if the variable is bound in this context.
 *
 * @param {Context} context
 * @param {API.Variable} variable
 */
const isBound = (context, variable) => {
  return context.frame.has(resolve(context, variable))
}

/**
 *
 * @param {Context} context
 * @param {API.Variable} variable
 * @param {API.Scalar} value
 */
const bind = (context, variable, value) => {
  context.frame.set(resolve(context, variable), value)
}

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
const get = (context, variable) => context.frame.get(resolve(context, variable))

/**
 *
 * @param {Context} context
 * @param {API.Variable} local
 * @param {API.Variable} remote
 */
const createReference = (context, local, remote) => {
  context.references.set(local, remote)
}
/**
 *
 * @param {Context} context
 */
const scope = (context) => {
  return new ContextView(context.references, new Map(context.frame))
}

class ContextView {
  static new() {
    return new this(new Map(), new Map())
  }
  /**
   * @param {References} references
   * @param {Frame} frame
   */
  constructor(references, frame) {
    this.references = references
    this.frame = frame
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
