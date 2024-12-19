import * as API from './api.js'
import * as Variable from './variable.js'
import * as Terms from './terms.js'
import * as Bindings from './bindings.js'
import * as Term from './term.js'
import { Constant, matchFact } from './lib.js'
import * as Formula from './formula.js'

/**
 * @param {API.Pattern} pattern
 */
export const select = (pattern) => Select.from(pattern)

/**
 * @template {API.Conclusion} Match
 * @param {API.DeductiveRule<Match>} source
 */
export const rule = (source) => DeductiveRule.from(source)

/**
 * @template {API.Conclusion} Match
 * @template {Match} Repeat
 * @param {API.InductiveRule<Match, Repeat>} source
 */
export const loop = (source) => InductiveRule.from(source)

/**
 * @template {API.Conclusion} Match
 * @param {API.RuleApplication<Match>} application
 */
export const plan = (application) => {
  const operation = RuleApplication.from(application)
  return operation.plan(new Set())
}

/**
 * @param {API.Operation} source
 */
export const from = (source) => {
  if (source.Select) {
    return Select.from(source.Select)
  } else if (source.Match) {
    return FormulaApplication.from(source.Match)
  } else if (source.Where) {
    return RuleApplication.from(source.Where)
  } else if (source.Not) {
    return Not.from(source.Not)
  } else {
    throw new SyntaxError(`Unsupported operation ${Object.keys(source)[0]}`)
  }
}

class Select {
  /**
   * @param {API.Pattern} pattern
   */
  static from(pattern) {
    const [entity, attribute, value] = pattern
    const cells = new Map()

    if (Variable.is(entity)) {
      cells.set(entity, 500)
    }
    if (Variable.is(attribute)) {
      cells.set(attribute, 200)
    }
    if (Variable.is(value)) {
      cells.set(value, 300)
    }

    return new this(pattern, cells)
  }
  /**
   * @param {API.Pattern} pattern
   * @param {Map<API.Variable, number>} cells
   */
  constructor(pattern, cells) {
    this.cells = cells
    this.pattern = pattern
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
    for (const bindings of selection) {
      const pattern = Bindings.resolve(bindings, this.pattern)
      const [entity, attribute, value] = pattern
      // Note: We expect that there will be LRUCache wrapping the db
      // so calling scan over and over again will not actually cause new scans.
      const facts = yield* source.scan({
        entity: Variable.is(entity) ? undefined : entity,
        attribute: Variable.is(attribute) ? undefined : attribute,
        value: Variable.is(value) ? undefined : value,
      })

      for (const fact of facts) {
        matches.push(...matchFact(fact, pattern, bindings))
      }
    }

    return matches
  }

  toJSON() {
    return {
      Select: this.pattern,
    }
  }

  /**
   * @param {Select} other
   */
  compare({ pattern: [toEntity, toAttribute, toValue] }) {
    const [entity, attribute, value] = this.pattern
    const termOrder = Term.compare(entity, toEntity)
    if (termOrder !== 0) {
      return termOrder
    }

    const attributeOrder = Term.compare(attribute, toAttribute)
    if (attributeOrder !== 0) {
      return attributeOrder
    }

    return Term.compare(value, toValue)
  }
}

class FormulaApplication {
  /**
   * @param {API.Formula} formula
   */
  static from(formula) {
    const [from, , to] = formula
    const cells = new Map()
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

    return new this(formula, cells)
  }
  /**
   * @param {API.Formula} formula
   * @param {Map<API.Variable, number>} cells
   */
  constructor(formula, cells) {
    this.cells = cells
    this.formula = formula
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
  evaluate(context) {
    return Formula.evaluate(context.source, this.formula, context.selection)
  }

  toJSON() {
    return {
      Match: this.formula,
    }
  }

  toDebugString() {
    const [from, formula, to] = this.formula
    const members = [Terms.toDebugString(from), JSON.stringify(formula)]
    if (to !== undefined) {
      members.push(Terms.toDebugString(to))
    }

    return `{ Match: [${members.join(', ')}] }`
  }

  /**
   * @param {FormulaApplication} other
   */
  compare(other) {
    const [from, formula, to] = this.formula
    const [vsIn, vsFormula, vsOut] = other.formula
    const inOrder = Terms.compare(from, vsIn)
    if (inOrder !== 0) {
      return inOrder
    }

    const formulaOrder = Constant.compare(formula, vsFormula)
    if (formulaOrder !== 0) {
      return formulaOrder
    }

    if (to === undefined) {
      return vsOut === undefined ? 0 : -1
    } else {
      return vsOut === undefined ? 1 : Terms.compare(to, vsOut)
    }
  }
}

/**
 * @template {API.Conclusion} [Match=API.Conclusion]
 */
class DeductiveRule {
  /**
   * @template {API.Conclusion} Case
   * @param {API.DeductiveRule<Case>} source
   */
  static from(source) {
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

    return new this(source.match, cells, total, when)
  }

  /**
   * @param {Match} match - Pattern to match against
   * @param {Map<API.Variable, number>} cells - Cost per variable when not bound
   * @param {number} cost - Base execution cost
   * @param {Record<string, Join>} when - Named deductive branches that must be evaluated
   */
  constructor(match, cells, cost, when) {
    this.case = match
    this.cells = cells
    this.cost = cost
    this.when = when
  }

  /**
   * @param {API.RuleBindings<Match>} terms
   * @returns {RuleApplication<Match>}
   */
  match(terms) {
    return RuleApplication.new(this, terms)
  }

  /**
   * @param {Set<API.Variable>} bindings
   */
  plan(bindings) {
    /** @type {Record<string, ReturnType<typeof Join.prototype.plan>>} */
    const when = {}
    let cost = 0
    const disjuncts = Object.entries(this.when)
    for (const [name, disjunct] of disjuncts) {
      const plan = disjunct.plan(bindings)
      when[name] = plan
      cost += plan.cost
    }

    // If we have no disjuncts there will be nothing raising problem if required
    // cell is not bound, which can happen in rules like this one
    // rule({ match: { this: $, as: $ } })
    // Which is why we need to perform validation here in such a case.
    if (disjuncts.length === 0) {
      for (const [variable, cost] of this.cells) {
        if (cost >= Infinity && !bindings.has(variable)) {
          throw new Error(
            `Rule application omits required binding for "${variable}" variable`
          )
        }
      }
    }

    return new DeductivePlan(this.case, when, cost)
  }
}

/**
 * @template {API.Conclusion} [Match=API.Conclusion]
 * @template {Match} [Repeat=Match]
 */
class InductiveRule {
  /**
   * @template {API.Conclusion} Match
   * @template {Match} [Repeat=Match]
   * @param {API.InductiveRule<Match, Repeat>} source
   */
  static from(source) {
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
    this.case = match
    this.when = when
    this.repeat = repeat
    this.loop = loop
    this.cells = cells
    this.cost = cost
  }

  /**
   * @param {API.RuleBindings<Match>} terms
   * @returns {RuleApplication<Match>}
   */
  match(terms) {
    return RuleApplication.new(this, terms)
  }

  /**
   * @param {Set<API.Variable>} bindings
   */
  plan(bindings) {
    const when = this.when.plan(bindings)
    let cost = when.cost
    /** @type {Record<string, ReturnType<typeof Join.prototype.plan>>} */
    const loop = {}
    for (const [name, deduction] of Object.entries(this.loop)) {
      const plan = deduction.plan(bindings)
      loop[name] = plan
      cost += plan.cost ** 2
    }

    return new InductionPlan(when, loop, cost)
  }
}

const EMPTY_SET = Object.freeze(new Set())

/**
 * @template {API.Conclusion} [Match=API.Conclusion]
 * @param {API.Rule<Match>} rule
 * @returns {rule is API.InductiveRule<Match>}
 */
const isInductive = (rule) => rule.repeat !== undefined
/**
 * @template {API.Conclusion} [Match=API.Conclusion]
 */
class RuleApplication {
  /**
   * @template {API.Conclusion} Match
   * @param {DeductiveRule<Match>|InductiveRule<Match>} rule
   * @param {API.RuleBindings<Match>} terms
   */
  static new(rule, terms) {
    const cells = new Map()
    // Map between rule's variables and application variables
    const mapping = new Map()

    for (const [at, inner] of Object.entries(rule.case)) {
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
        cells.set(term, cost)
      }
      mapping.set(inner, term)
    }

    return new this(terms, rule, mapping, cells)
  }
  /**
   * @template {API.Conclusion} [Match=API.Conclusion]
   * @param {API.RuleApplication<Match>} source
   * @returns {RuleApplication<Match>}
   */
  static from(source) {
    // Build the underlying rule first
    const rule =
      isInductive(source.rule) ?
        InductiveRule.from(source.rule)
      : DeductiveRule.from(source.rule)

    return this.new(rule, source.match)
  }

  /**
   * @param {API.RuleBindings<Match>} match
   * @param {DeductiveRule<Match>|InductiveRule<Match>} rule
   * @param {Map<API.Variable, API.Variable>} mapping
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
   * @param {Set<API.Variable>} bindings
   */
  plan(bindings = EMPTY_SET) {
    // Convert outer bindings to rule's internal variables
    const scope = new Set()
    for (const [inner, outer] of this.mapping) {
      if (!Variable.is(outer) || bindings.has(outer)) {
        scope.add(inner)
      }
    }

    return new RuleApplicationPlan(
      this.match,
      this.rule.plan(scope),
      this.mapping
    )
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

class Join {
  /**
   * @param {object} source
   * @param {Map<API.Variable, string>} source.bindings
   * @param {string|number} source.name
   * @param {API.Conjuncts} source.conjuncts
   */
  static from({ name, conjuncts, bindings }) {
    const cells = new Map()
    const dependencies = new Map()
    let total = 0

    let inputs = new Set()
    let outputs = new Set()
    const assertion = []
    const negation = []

    for (const conjunct of conjuncts.map(from)) {
      if (conjunct instanceof Not) {
        negation.push(conjunct)
      } else {
        assertion.push(conjunct)
      }

      total += conjunct.cost ?? 0

      for (const [variable, cost] of conjunct.cells) {
        // Only track costs for variables exposed in rule match
        if (bindings.has(variable)) {
          const base = cells.get(variable) ?? 0
          cells.set(variable, base + cost)
        }
        // Local variables contribute to base cost
        else {
          total += cost
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

    // Check for unresolvable cycles
    for (const cycle of findUnresolvableCycle(dependencies)) {
      throw new ReferenceError(
        `Unresolvable circular dependency in clause: ${cycle.join(' -> ')}`
      )
    }

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
   * @param {ReturnType<from>[]} assertion
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
   * @param {Set<API.Variable>} scope
   * @returns {API.EvaluationPlan}
   */
  plan(scope) {
    const bindings = new Set(scope)
    /** @type {Map<API.Variable, Set<typeof this.assertion[0]>>} */
    const blocked = new Map()
    /** @type {Set<typeof this.assertion[0]>} */
    const ready = new Set()
    let cost = 0

    // Initial setup - check which operations are ready vs blocked
    for (const assertion of this.assertion) {
      let requires = 0
      for (const [variable, cost] of assertion.cells) {
        if (cost >= Infinity && !bindings.has(variable)) {
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
        const cost = estimate(current, bindings)

        if (cost < (top?.cost ?? Infinity)) {
          top = { cost, current }
        }
      }

      if (!top) {
        throw new ReferenceError(
          `Cannot plan ${blocked.keys()} deduction without required cells`
        )
      }

      ordered.push(top.current.plan(bindings))
      ready.delete(top.current)
      cost += top.cost

      // Update blocked operations based on new outputs
      const unblocked = top.current.cells
      for (const [variable, cost] of unblocked) {
        const waiting = blocked.get(variable)
        if (waiting) {
          for (const assertion of waiting) {
            let unblock = true
            for (const [variable, cost] of assertion.cells) {
              // If cell is required and is still not available, we can't
              // unblock it yet.
              if (
                cost >= Infinity &&
                !bindings.has(variable) &&
                !unblocked.has(variable)
              ) {
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
        bindings.add(variable)
      }
    }

    if (blocked.size > 0) {
      const [[variable, [conjunct]]] = blocked.entries()
      throw new ReferenceError(
        `Unbound ${variable} variable referenced from ${toDebugString(
          conjunct
        )}`
      )
    }

    return new JoinPlan(
      ordered,
      this.negation.map((negation) => negation.plan(bindings)),
      cost
    )
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
   * @param {API.RuleBindings<Match>} match
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
   * @param {Map<API.Variable, API.Variable>} mapping - inner -> outer variable mapping
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
      let scope = {}
      for (const [inner, outer] of this.mapping) {
        const value = Bindings.get(bindings, outer)
        if (value !== undefined) {
          const result = Term.unify(inner, inner, scope)
          if (result.error) {
            continue next
          } else {
            scope = result.ok
          }
        }
      }

      // Execute rule with isolated bindings
      const results = yield* this.plan.evaluate({
        source,
        selection: [scope],
      })

      // For each result, create new outer bindings with mapped values
      for (const result of results) {
        const output = { ...bindings }
        for (const [inner, outer] of this.mapping) {
          const value = Bindings.get(result, inner)
          if (value !== undefined) {
            Bindings.set(output, outer, value)
          }
        }
        matches.push(output)
      }
    }

    return matches
  }

  toJSON() {
    return {
      Where: {
        match: this.match,
        rule: toJSON(this.plan),
      },
    }
  }
}
/**
 * Calculates cost of the executing this operation.
 *
 * @param {object} operation
 * @param {number} [operation.cost]
 * @param {Map<API.Variable, number>} operation.cells
 * @param {Set<API.Variable>} [scope]
 */
const estimate = ({ cells, cost = 0 }, scope) => {
  let total = cost
  for (const [variable, cost] of cells) {
    if (scope && !scope.has(variable)) {
      total += cost
    }
  }
  return total
}

/**
 * @typedef {Select|FormulaApplication|RuleApplication} Constraint
 */
class Not {
  /**
   * @param {API.Constraint} constraint
   */
  static from(constraint) {
    const operation =
      constraint.Select ? Select.from(constraint.Select)
      : constraint.Match ? FormulaApplication.from(constraint.Match)
      : RuleApplication.from(constraint.Where)

    // Not's cost includes underlying operation
    const cells = new Map()
    for (const [variable, cost] of operation.cells) {
      // Not has no output but all the inputs must be bound before it can be
      // evaluated.
      if (cost > 0) {
        cells.set(variable, cost)
      }
    }

    return new this(operation, cells)
  }
  /**
   *
   * @param {Constraint} constraint
   * @param {Map<API.Variable, number>} cells
   */
  constructor(constraint, cells) {
    this.constraint = constraint
    this.cells = cells
  }

  get cost() {
    return this.constraint.cost
  }

  /**
   * @param {Set<API.Variable>} bindings
   * @returns {Negate}
   */
  plan(bindings) {
    return new Negate(this.constraint.plan(bindings))
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
    return { Not: toJSON(this.operand) }
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
