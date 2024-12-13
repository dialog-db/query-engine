import * as API from './api.js'
import * as Variable from './variable.js'
import * as Terms from './terms.js'
import * as Term from './term.js'
import { Constant, evaluateCase, evaluateRule, Var } from './lib.js'
import { isEmpty } from './iterable.js'
import * as Formula from './formula.js'

/**
 * @typedef {Case|Or|And|Not|Is|Match|RuleApplication} Branch
 * @typedef {Branch|Induction} RuleBranch
 */
/**
 * @param {API.Clause} clause
 * @returns {Branch}
 */
export function analyze(clause) {
  if (clause.Case) {
    return Case.analyze(clause.Case)
  } else if (clause.Or) {
    return Or.analyze(clause.Or)
  } else if (clause.And) {
    return And.analyze(clause.And)
  } else if (clause.Not) {
    return Not.analyze(clause.Not)
  } else if (clause.Is) {
    return Is.analyze(clause.Is)
  } else if (clause.Match) {
    return Match.analyze(clause.Match)
  } else if (clause.Rule) {
    return RuleApplication.analyze(clause.Rule)
  } else {
    throw new SyntaxError(`Unsupported clause kind ${Object.keys(clause)[0]}`)
  }
}

/**
 * @param {(API.Clause & {plan?:undefined})|Branch} clause
 * @param {Partial<Context>} context
 */
export function plan(
  clause,
  { bindings = new Set(), scope = new Scope() } = {}
) {
  if (clause.plan) {
    return clause.plan({ bindings, scope })
  } else {
    return analyze(clause).plan({ bindings, scope })
  }
}

const ENTITY_SELECTIVITY = 50
const ATTRIBUTE_SELECTIVITY = 70
// Between known entity and attribute
const SPECULATIVE_VALUE_SELECTIVITY = 60

// Base cost of 1M for full scan
const FULL_SCAN = 1_000_000

/**
 * @typedef {Object} Context
 * @property {Set<API.VariableID>} bindings
 * @property {Scope} scope
 */

class Case {
  /**
   * @param {Context} context
   */
  plan(context) {
    const [entity, attribute, value] = this.pattern
    // Multipliers as percentages (out of 100)
    const entityMultiplier =
      !Variable.is(entity) ? ENTITY_SELECTIVITY
      : context.bindings.has(Variable.id(entity)) ? ENTITY_SELECTIVITY
      : 100

    const attributeMultiplier =
      !Variable.is(attribute) ? ATTRIBUTE_SELECTIVITY
      : context.bindings.has(Variable.id(attribute)) ? ATTRIBUTE_SELECTIVITY
      : 100

    // Value selectivity returns integers 1-100
    const valueMultiplier =
      !Variable.is(value) ? estimateSelectivity(value)
      : context.bindings.has(Variable.id(value)) ? SPECULATIVE_VALUE_SELECTIVITY
      : 100

    // Calculate index efficiency multiplier based on available patterns
    // Index efficiency as percentage multiplier
    const indexMultiplier =
      entityMultiplier < 100 && attributeMultiplier < 100 ?
        100 // EAV
      : valueMultiplier < 100 && attributeMultiplier < 100 ?
        100 // VAE
      : attributeMultiplier < 100 ?
        200 // AEV
      : 400 // No index

    // Normalize the multipliers (divide by 100 for each percentage multiplier)
    const cost =
      (FULL_SCAN *
        entityMultiplier *
        attributeMultiplier *
        valueMultiplier *
        indexMultiplier) /
      1_000_000 // 100 * 100 * 100

    return new CasePlan(cost, this.pattern)
  }

  /**
   * @param {API.Pattern} pattern
   */
  static analyze(pattern) {
    const output = new Set()

    const [entity, attribute, value] = pattern
    for (const term of [entity, attribute, value]) {
      if (Variable.is(term)) {
        const id = Variable.id(term)
        output.add(id)
      }
    }

    return new this(pattern, new Set(), output)
  }
  /**
   * @param {API.Pattern} pattern
   * @param {Set<API.VariableID>} input
   * @param {Set<API.VariableID>} output
   */
  constructor(pattern, input, output) {
    this.pattern = pattern
    this.input = input
    this.output = output

    this.effects = Effects.build({ query: [{ select: pattern }] })
  }

  /**
   * @param {API.VariableID} id
   */
  has(id) {
    return this.output.has(id) || this.input.has(id)
  }

  get Case() {
    return this.pattern
  }
}

/**
 * Returns integer 1-100 representing selectivity
 * Lower = more selective = better
 *
 * @param {API.Constant} value
 */
const estimateSelectivity = (value) => {
  const entropy = Constant.entropy(value)
  // Convert entropy to percentage (1-100)
  return Math.min(100, Math.max(1, Math.floor(1000 / (entropy + 10))))
}

/**
 * Analyzes Or clause branches to identify:
 * - inputs: variables required by any branch
 * - outputs: variables bound by all branches
 * - extensions: variables bound by some but not all branches
 *
 * Extensions require special handling - if they appear in outer scope
 * they must be bound before Or executes. This ensures consistent variable
 * bindings regardless of which branch executes.
 */
class Or {
  /**
   * @param {API.Clause[]} branches
   */
  static analyze(branches) {
    // Flatten nested Or clauses to remove redundancy
    const [first, ...rest] = disjuncts(branches)
    // Start with first branch outputs as candidates for consistent outputs
    const top = analyze(first)
    const analysis = [top]
    const input = new Set(top.input)
    const output = new Set(top.output)
    const extension = new Set()
    const effects = Effects.new().merge(top.effects)

    // Process remaining branches
    for (const disjunct of rest) {
      const current = analyze(disjunct)
      analysis.push(current)
      effects.merge(current.effects)

      for (const id of current.input) {
        input.add(id)
      }

      // If an "output" isn't produced by this branch, it becomes an extension
      for (const id of output) {
        if (!current.output.has(id)) {
          extension.add(id)
          output.delete(id)
        }
      }

      // New outputs in this branch are extensions
      for (const id of current.output) {
        if (!output.has(id)) {
          extension.add(id)
        }
      }
    }

    return new this(analysis, effects, input, output, extension)
  }

  /**
   * @param {Branch[]} branches
   * @param {API.Effects} effects
   * @param {Set<API.VariableID>} input
   * @param {Set<API.VariableID>} output
   * @param {Set<API.VariableID>} extension
   */
  constructor(branches, effects, input, output, extension) {
    this.branches = branches
    this.effects = effects
    this.input = input
    this.output = output
    this.extension = extension
  }

  /**
   * @param {API.VariableID} id
   */
  has(id) {
    return this.input.has(id) || this.output.has(id) || this.extension.has(id)
  }

  get Or() {
    return this.branches
  }

  /**
   * Plans Or clause execution ensuring proper handling of extensions.
   * Extensions that appear in outer scope must be bound before execution
   * to maintain consistent variable bindings across branches.
   *
   * @param {Context} context
   * @returns {OrPlan|Unplannable}
   */
  plan(context) {
    // Extensions must be bound if they appear in outer scope
    for (const id of this.extension) {
      if (context.scope.has(id) && !context.bindings.has(id)) {
        return new Unplannable(
          new Set([id]),
          `Variable ${id} must be bound or used consistently across all Or branches`
        )
      }
    }

    const plans = []
    let cost = 0
    for (const branch of this.branches) {
      const plan = branch.plan(context)

      if (plan.error) {
        return plan
      }

      cost = Math.max(cost, plan.cost)
      plans.push(plan)
    }

    return new OrPlan(cost, plans)
  }
}

class And {
  /**
   * @param {Branch[]} binding
   * @param {Branch[]} elimination
   * @param {API.Effects} effects
   * @param {Set<API.VariableID>} input
   * @param {Set<API.VariableID>} output
   */
  constructor(binding, elimination, effects, input, output) {
    this.binding = binding

    /**
     * Negation should run after all the variables that can be bound are bound
     * before they are evaluated otherwise it may eliminate more bindings than
     * it should. It's easier understand this with an an example
     *
     * ```json
     * {
     *   { Case: [$.child, "semantic/type", "child"] },
     *   { Not: { Case: [$.child, "legal/guardian", $.uncle] } },
     *   { Case: [$.uncle, "relation/nephew", $.child] },
     * ]
     * ```
     *
     * `Case` clause inside the `Not` has only output variables and if engine
     * evaluated steps in the written order it would first have found all
     * entities thar are children. Then it would have eliminated all that have
     * "legal/guardian" and then if anything was left left it would have
     * eliminated anything that had an uncle. This would have been incorrect
     * because expression meant to describe all the children who legal guardian
     * is not their uncle. More concretely children who have a grandparent as
     * their legal guardian would have being eliminated if steps were evaluated
     * in the written order, while what we would have expected is that all
     * children with grandparent as their guardian would have being kept.
     *
     * This is why we categorize negations as elimination steps and separate
     * from the binding steps. This way we will plan to execute all the binding
     * steps before we evaluate elimination steps ensuring that all the variables
     * that could have being bound are bound.
     */
    this.elimination = elimination

    this.effects = effects

    this.input = input
    this.output = output
  }
  /** @type {Branch[]} */
  get And() {
    return [...this.binding, ...this.elimination]
  }

  /**
   * @param {API.Clause[]} clauses
   */
  static analyze(clauses) {
    const input = new Set()
    const output = new Set()
    const dependencies = new Map()
    const effects = Effects.new()

    // Partition steps into binding and elimination
    const binding = []
    const elimination = []

    for (const clause of conjuncts(clauses)) {
      const step = analyze(clause)
      effects.merge(step.effects)

      if (step instanceof Not) {
        elimination.push(step)
      } else {
        binding.push(step)
      }

      for (const id of step.input) {
        if (!output.has(id)) {
          input.add(id)
        }
      }

      for (const id of step.output) {
        output.add(id)
        depend(dependencies, [id], step.input)
        if (input.has(id)) {
          input.delete(id)
        }
      }
    }

    // Check for unresolvable cycles
    for (const cycle of findUnresolvableCycle(dependencies)) {
      throw new ReferenceError(
        `Unresolvable circular dependency in And clause: ${cycle.join(' -> ')}`
      )
    }

    return new this(binding, elimination, effects, input, output)
  }

  /**
   * @param {Context} context
   * @returns {AndPlan|Unplannable}
   */
  plan(context) {
    const bindings = new Set(context.bindings)
    const steps = new Set([...this.binding])
    // Scope should contain variable from the provided context and all the
    // variables from all the conjuncts.
    const scope = new Scope(
      new Set([context.scope, ...this.binding, ...this.elimination])
    )
    const stack = []
    const negation = []
    let cost = 0

    while (steps.size > 0) {
      let top = null
      let error = null

      for (const step of steps) {
        const plan = step.plan({
          bindings,
          // Exclude current step from the scope so it can correctly identify
          // own local variables.
          scope: scope.without(step),
        })

        if (plan.error) {
          error = plan.error
          continue
        }

        if (!top || plan.cost < top.plan.cost) {
          top = { plan, step }
        }
      }

      if (!top) {
        return (
          error ??
          new Unplannable(
            new Set(
              [...steps]
                .flatMap((step) => [...step.input])
                .filter((v) => !context.bindings.has(v))
            )
          )
        )
      }

      steps.delete(top.step)
      stack.push(top.plan)
      cost += top.plan.cost

      // Update bindings for next iteration
      for (const variable of top.step.output) {
        bindings.add(variable)
      }
    }

    for (const step of this.elimination) {
      const plan = step.plan({
        bindings,
        scope: scope.without(step),
      })

      if (plan.error) {
        return plan
      }

      // Update bindings for next iteration
      for (const variable of step.output) {
        context.bindings.add(variable)
      }

      negation.push(plan)
      cost += plan.cost
    }

    return new AndPlan(
      cost,
      stack,
      negation.sort((a, b) => a.cost - b.cost)
    )
  }

  /**
   * @param {API.VariableID} id
   */
  has(id) {
    return this.input.has(id) || this.output.has(id)
  }
}

/**
 * Flattens nested And clauses
 *
 * @param {API.Clause[]} conjuncts
 */
const conjuncts = (conjuncts) => {
  const result = []
  const stack = [...conjuncts]
  while (stack.length) {
    const conjunct = /** @type {API.Clause} */ (stack.shift())
    if (conjunct.And) {
      stack.unshift(...conjunct.And)
    } else {
      result.push(conjunct)
    }
  }
  return result
}

/**
 * Flattens nested Or clauses
 *
 * @param {API.Clause[]} disjuncts
 */
const disjuncts = (disjuncts) => {
  const result = []
  const stack = [...disjuncts]
  while (stack.length) {
    const disjunct = /** @type {API.Clause} */ (stack.shift())
    if (disjunct.Or) {
      stack.unshift(...disjunct.Or)
    } else {
      result.push(disjunct)
    }
  }
  return result
}

class Not {
  /**
   * @param {Branch} step
   */
  constructor(step) {
    this.step = step

    /**
     * Negation does not bind any variables it just eliminates matched bindings.
     * @type {Set<API.VariableID>}
     */
    this.output = new Set()

    /**
     * Negation needs all the input variables of the underlying step to be bound
     * before it can be evaluated. However while all the output variables of the
     * underlying step that CAN BE bound MUST be bound before negation is
     * evaluated, we can not list them as input variables because they may not
     * local to this negation step. Consider the following example:
     *
     * ```json
     * [
     *    { Case: [$.article, "article/title", $.title] },
     *    {
     *      Not: {
     *        And: [
     *          { Case: [$.article, "article/author", $.author] },
     *          { Case: [$.author, "user/status", "blocked"] }
     *        ]
     *      }
     *    }
     * ]
     * ```
     *
     * Here `$.author` is fully local to the Not clause and it may not be bound
     * by any other step.
     *
     * @type {Set<API.VariableID>}
     */
    this.input = step.input
  }

  /** @type {API.Effects} */
  get effects() {
    return this.step.effects
  }

  /**
   * @param {API.Clause} clause
   */
  static analyze(clause) {
    return new this(analyze(clause))
  }

  get Not() {
    return this.step
  }

  /**
   * @param {Context} context
   * @returns {NotPlan|Unplannable}
   */
  plan(context) {
    const plan = this.step.plan(context)
    if (plan.error) {
      return plan
    } else {
      return new NotPlan(plan.cost, plan)
    }
  }

  /**
   * @param {API.VariableID} id
   */
  has(id) {
    return this.input.has(id) || this.output.has(id)
  }
}

class Is {
  /**
   * @param {API.Is} relation
   */
  static analyze(relation) {
    const [actual, expect] = relation
    const output = new Set()
    if (Variable.is(actual)) {
      output.add(Variable.id(actual))
    }

    if (Variable.is(expect)) {
      output.add(Variable.id(expect))
    }

    return new this(relation, new Set(), output)
  }
  /**
   * @param {API.Is} relation
   * @param {Set<API.VariableID>} input
   * @param {Set<API.VariableID>} output
   */
  constructor(relation, input, output) {
    this.relation = relation
    this.input = input
    this.output = output
  }
  get Is() {
    return this.relation
  }

  get effects() {
    return Effects.none
  }

  /**
   * @param {Context} context
   * @returns {IsPlan|Unplannable}
   */
  plan(context) {
    const missingInputs = [...this.output].filter(
      (v) => !context.bindings.has(v)
    )

    if (missingInputs.length > 1) {
      return new Unplannable(new Set(missingInputs))
    }

    // If we can plan `is` execution cost is 0 because it simply binds the
    // variable or eliminates the bindings. It is ok if we have not bound the
    // other variable yet because this will bind it and any other step will
    // end up having to unify.
    return new IsPlan(0, this.relation)
  }

  /**
   * @param {API.VariableID} id
   */
  has(id) {
    return this.output.has(id) || this.input.has(id)
  }
}

class Match {
  /**
   * @param {API.Formula} relation
   */
  static analyze(relation) {
    const [from, , to] = relation
    const input = new Set()
    const output = new Set()

    for (const variable of Terms.variables(from)) {
      input.add(Variable.id(variable))
    }

    for (const variable of Terms.variables(to)) {
      const id = Variable.id(variable)
      if (input.has(id)) {
        throw new ReferenceError(
          `Variable ${variable} cannot appear in both input and output of Match clause`
        )
      }
      output.add(id)
    }

    return new this(relation, input, output)
  }
  /**
   * @param {API.Formula} relation
   * @param {Set<API.VariableID>} input
   * @param {Set<API.VariableID>} output
   */
  constructor(relation, input, output) {
    this.relation = relation
    this.input = input
    this.output = output
  }

  get effects() {
    return Effects.none
  }

  get Match() {
    return this.relation
  }

  /**
   * @param {Context} context
   * @returns {MatchPlan|Unplannable}
   */
  plan(context) {
    const missingInputs = [...this.input].filter(
      (v) => !context.bindings.has(v)
    )
    if (missingInputs.length > 0) {
      return new Unplannable(new Set(missingInputs))
    }

    const count = [...this.output].filter(
      (v) => !context.bindings.has(v)
    ).length

    // We calculate cost per new binding.It seems that running any match clause
    // ahead of the scans would be beneficial because it will bind the variables
    // without having to perform any scans.
    const cost = count > 0 ? 20 / count : 20

    return new MatchPlan(cost, this.relation)
  }

  /**
   * @param {API.VariableID} id
   */
  has(id) {
    return this.input.has(id) || this.output.has(id)
  }
}

class Unplannable extends Error {
  /** @type {undefined} */
  cost

  /**
   * @param {Set<API.VariableID>} missing
   */
  constructor(
    missing,
    message = `Cannot complete plan - some steps have unresolvable dependencies: ${[
      ...missing,
    ]}`
  ) {
    super(message)
  }

  get error() {
    return this
  }

  toJSON() {
    return {
      error: {
        name: this.name,
        message: this.message,
        stack: this.stack,
      },
    }
  }
}

/**
 * @implements {API.EvaluationPlan}
 */
class AndPlan {
  /** @type {undefined} */
  error
  /**
   * @param {number} cost
   * @param {API.EvaluationPlan[]} bindings
   * @param {API.EvaluationPlan[]} eliminations
   */
  constructor(cost, bindings, eliminations) {
    this.cost = cost
    this.bindings = bindings
    this.eliminations = eliminations
  }

  toJSON() {
    return {
      And: [...this.bindings, ...this.eliminations].map((plan) =>
        plan.toJSON()
      ),
    }
  }

  /**
   * @param {API.EvaluationContext} context
   */
  *evaluate({ source, selection }) {
    // Execute binding steps in planned order
    for (const plan of this.bindings) {
      selection = yield* plan.evaluate({ source, selection })
    }

    // Then execute elimination steps
    for (const plan of this.eliminations) {
      selection = yield* plan.evaluate({ source, selection })
    }

    return selection
  }
}

class CasePlan {
  /** @type {undefined} */
  error
  /**
   * @param {number} cost
   * @param {API.Pattern} pattern
   */
  constructor(cost, pattern) {
    this.cost = cost
    this.pattern = pattern
  }

  toJSON() {
    return {
      Case: this.pattern,
    }
  }

  /**
   * @param {API.EvaluationContext} context
   */
  evaluate({ source, selection }) {
    return evaluateCase(source, this.pattern, selection)
  }
}

class NotPlan {
  /** @type {undefined} */
  error
  /**
   * @param {number} cost
   * @param {API.EvaluationPlan} plan
   */
  constructor(cost, plan) {
    this.cost = cost
    this.plan = plan
  }

  toJSON() {
    return {
      Not: this.plan.toJSON(),
    }
  }

  /**
   * @param {API.EvaluationContext} context
   */
  *evaluate({ source, selection }) {
    const matches = []
    for (const match of selection) {
      const exclude = yield* this.plan.evaluate({
        source,
        selection: [match],
      })

      if (isEmpty(exclude)) {
        matches.push(match)
      }
    }
    return matches
  }
}

class OrPlan {
  /** @type {undefined} */
  error
  /**
   * @param {number} cost
   * @param {API.EvaluationPlan[]} disjuncts
   */
  constructor(cost, disjuncts) {
    this.cost = cost
    this.disjuncts = disjuncts
  }

  /**
   * @param {API.EvaluationContext} context
   */
  *evaluate(context) {
    const matches = []
    // We could run all disjuncts in parallel but for simplicity we'll run them
    // sequentially.
    for (const disjunct of this.disjuncts) {
      const bindings = yield* disjunct.evaluate(context)
      matches.push(...bindings)
    }

    return matches
  }

  toJSON() {
    return {
      Or: this.disjuncts.map((disjunct) => disjunct.toJSON()),
    }
  }
}

class MatchPlan {
  /** @type {undefined} */
  error
  /**
   * @param {number} cost
   * @param {API.Formula} formula
   */
  constructor(cost, formula) {
    this.cost = cost
    this.formula = formula
  }

  /**
   * @param {API.EvaluationContext} context
   */
  *evaluate({ source, selection }) {
    return yield* Formula.evaluate(source, this.formula, selection)
  }

  toJSON() {
    return {
      Match: this.formula,
    }
  }
}

class IsPlan {
  /** @type {undefined} */
  error
  /**
   * @param {number} cost
   * @param {API.Is} relation
   */
  constructor(cost, relation) {
    this.cost = cost
    this.relation = relation
  }

  /**
   * @param {API.EvaluationContext} context
   */
  *evaluate({ selection }) {
    const [expect, actual] = this.relation
    const matches = []
    for (const bindings of selection) {
      const result = Term.unify(expect, actual, bindings)
      if (!result.error) {
        matches.push(result.ok)
      }
    }
    return matches
  }

  toJSON() {
    return {
      Is: this.relation,
    }
  }
}

/**
 * @typedef {object} ScopeMember
 * @property {(id: API.VariableID) => boolean} has
 */

export class Scope {
  /**
   * @param {Set<ScopeMember>} members
   * @param {unknown} except
   */
  constructor(members = new Set(), except = null) {
    this.members = members
    this.except = except
  }

  /**
   * @param {API.VariableID} id
   * @returns {boolean}
   */
  has(id) {
    for (const member of this.members) {
      if (member !== this.except && member.has(id)) {
        return true
      }
    }
    return false
  }

  /**
   * @param {ScopeMember} branch
   * @returns {Scope}
   */
  without(branch) {
    this.except = branch
    return this
  }
  /**
   * @param {Set<ScopeMember>} members
   */
  reset(members = this.members) {
    this.members = members
    this.except = null
  }
}

/**
 * @template {API.Conclusion} [Case=API.Conclusion]
 */
class RuleApplication {
  /**
   * @template {API.Conclusion} Case
   * @param {API.RuleApplication<Case>} source
   */
  static analyze(source) {
    const application = new Map()
    const input = new Set()
    const output = new Set()

    // Build a rule from it's source which will validate all of the inductive
    // and deductive branches.
    const rule = Rule.build(source.rule)

    // Build mapping between rule and it's application scope.
    for (const [at, variable] of Object.entries(rule.relation)) {
      const inner = Variable.id(variable)
      const term = source.match[at]
      // If binding is not provided during application, but it is used as input
      // inside a rule we raise a reference error because variable is not bound.
      if (term === undefined && rule.input.has(inner)) {
        throw new ReferenceError(
          `Rule application omits input binding for "${at}" relation`
        )
      }

      // If provided term in the application is a variable we create a mapping
      // between inner and outer scope variables.
      if (Variable.is(term)) {
        const outer = Variable.id(term)
        application.set(inner, outer)

        // If variable is used as an input by the rule we capture corresponding
        // variable in an outer scope as an input.
        if (rule.input.has(inner)) {
          input.add(outer)
        }
        // If variable is used as an output by the rule we capture corresponding
        // variable in an outer scope as an output.
        else if (rule.output.has(inner)) {
          output.add(outer)
        }
        // If variable is not used neither as input nor as an output by the rule
        // it implies that we rule may not have a body and it's variables are
        // used for unification.
        else {
          input.add(outer)
        }
      }
    }

    return new this(rule, source.match, application, input, output)
  }
  /**
   * @param {Rule<Case>} rule
   * @param {API.RuleBindings<Case>} match
   * @param {Map<number, number>} application
   * @param {Set<number>} input
   * @param {Set<number>} output
   */
  constructor(rule, match, application, input, output) {
    this.rule = rule
    this.match = match
    this.application = application
    this.input = input
    this.output = output
  }

  /**
   * @param {API.VariableID} id
   */
  has(id) {
    return this.input.has(id) || this.output.has(id)
  }

  get effects() {
    return this.rule.effects
  }

  /**
   * @param {Context} context
   * @returns {RuleApplicationPlan<Case>|Unplannable}
   */
  plan(context) {
    // Create new context for rule scope (empty as rule body doesn't share vars)
    const bindings = new Set()
    const scope = new Scope()

    // Map application bindings to corresponding rule bindings
    for (const [inner, outer] of this.application) {
      // If binding is provided in the context we add corresponding binding for
      // for the rule premise.
      if (outer != null && context.bindings.has(outer)) {
        bindings.add(inner)
      }
      // If binding is not provided we check if it is an input, if it is we
      // can not plan the rule until input will be bound.
      else if (this.input.has(outer)) {
        return new Unplannable(
          new Set([outer]),
          'Required rule binding not bound'
        )
      }
    }

    // Plan all deductive branches
    /** @type {Map<string, API.Plan>} */
    const deduce = new Map()
    let cost = 0

    // Count total queries and loops across all branches
    const countQueries = this.rule.effects.query.length
    const countLoops = this.rule.effects.loop.length

    // Plan each deductive branch
    for (const [name, deduction] of this.rule.deduce) {
      const plan = deduction.plan({ bindings, scope })

      if (plan.error) {
        return plan
      }

      deduce.set(name, plan)

      // Base cost from branch execution
      cost = Math.max(cost, plan.cost)
    }

    /** @type {Map<string, InductionPlan>} */
    const induce = new Map()
    for (const [name, induction] of this.rule.induce) {
      const plan = induction.plan({ bindings, scope })

      if (plan.error) {
        return plan
      }

      induce.set(name, plan)
      cost = Math.max(cost, plan.cost)
    }

    // Adjust cost based on number of queries rule will perform
    if (countQueries > 0) {
      // More queries = higher cost
      cost *= 1 + countQueries * 0.5
    }

    // Exponentially increase cost based on number of loops
    // For example:
    // - 1 loop:  cost ^ (1 + 0.2) = cost ^ 1.2
    // - 2 loops: cost ^ (1 + 0.4) = cost ^ 1.4
    // - 5 loops: cost ^ (1 + 1.0) = cost ^ 2.0
    // This reflects that each loop potentially multiplies the work,
    // but with diminishing impact to avoid over-penalizing
    if (countLoops > 0) {
      cost = cost ** (1 + countLoops * 0.2)
    }

    return new RuleApplicationPlan(cost, this, deduce, induce)
  }
}

/**
 * @template {API.Conclusion} Case
 */
class RuleApplicationPlan {
  /** @type {undefined} */
  error
  /**
   * @param {number} cost
   * @param {RuleApplication<Case>} application
   * @param {Map<string, API.Plan>} deduce
   * @param {Map<string, InductionPlan>} induce
   */
  constructor(cost, application, deduce, induce) {
    this.cost = cost
    this.application = application
    this.deduce = deduce
    this.induce = induce
  }
  get match() {
    return this.application.match
  }
  toJSON() {
    return {
      Rule: {
        match: this.application.match,
        rule: this.application.rule,
        deduce: this.deduce,
        induce: this.induce,
      },
    }
  }

  /**
   * @param {API.EvaluationContext} context
   */
  evaluate({ source, selection }) {
    return evaluateRule(source, this.application, selection)
  }
}

/**
 * @template {API.Conclusion} Relation
 */
class Rule {
  /**
   * @template {API.Conclusion} Relation
   * @param {Relation} relation
   */
  static new(relation) {
    return new this(relation)
  }

  /**
   * @template {API.Conclusion} Relation
   * @param {API.Rule<Relation>} source
   * @returns {Readonly<Rule<Relation> & { effects: API.Effects }>}
   */
  static build(source) {
    return this.new(source.match)
      .with(source.when ?? [])
      .build()
  }
  /**
   * @param {Relation} relation
   */
  constructor(relation) {
    this.relation = relation

    this.bindings = new Set()
    for (const variable of Object.values(relation)) {
      this.bindings.add(Variable.id(variable))
    }

    /** @type {Map<string, Induction>} */
    this.induce = new Map()
    /** @type {Map<string, Deduction>} */
    this.deduce = new Map()

    this.input = new Set()
    this.output = new Set()

    this.effects = Effects.new()

    this.when = [...Object.values(this.induce), ...Object.values(this.deduce)]
  }

  /**
   * @param {API.When} extension
   */
  with(extension) {
    for (const [name, source] of Object.entries(extension)) {
      let member
      if (source.Recur) {
        member = Induction.build([name, source.Recur], this)
        this.induce.set(name, member)
      } else {
        member = Deduction.build([name, source], this)
        this.deduce.set(name, member)
      }

      const { input, output, effects } = member

      // Incorporate effects
      this.effects.merge(effects)

      // Union of all inputs are considered an input of the rule
      for (const id of input) {
        this.input.add(id)
        this.output.delete(id)
      }

      // Intersection of all outputs that aren't input is considered an output
      // of the rule
      for (const id of output) {
        if (!this.input.has(id)) {
          this.output.add(id)
        }
      }
    }

    return this
  }

  build() {
    if (this.deduce.size === 0 && this.induce.size > 0) {
      throw new SyntaxError('Rule may not have just inductive branches')
    }

    return this
  }

  get match() {
    return this.relation
  }
}

const RECURSION_COST = 0

class Deduction {
  /**
   * @template {API.Conclusion} Case
   * @param {[string|number, API.Clause]} source
   * @param {Rule<Case>} rule
   */
  static build([name, source], rule) {
    const premise = analyze(source)

    // Verify that all the relations declared by the rule are bound by the
    // deduction.
    for (const [at, variable] of Object.entries(rule.relation)) {
      const id = Variable.id(variable)
      if (!premise.input.has(id) && !premise.output.has(id)) {
        throw new ReferenceError(
          `Deductive rule branch "${name}" does not bind "${at}" relation`
        )
      }
    }

    // Verify that deduction does not have an unbound input variables.
    for (const id of premise.input) {
      if (!rule.bindings.has(id)) {
        throw new ReferenceError(
          `Unbound ${id} variable referenced from deductive rule branch ${name}`
        )
      }
    }

    return new this(premise)
  }
  get input() {
    return this.premise.input
  }
  get output() {
    return this.premise.output
  }
  /**
   * @param {Branch} premise
   */
  constructor(premise) {
    this.premise = premise
  }
  get effects() {
    return this.premise.effects
  }
  /**
   * @param {Context} context
   */
  plan(context) {
    return this.premise.plan(context)
  }
}

/**
 * @template {API.Conclusion} [Case=API.Conclusion]
 */
class Induction {
  /**
   * @template {API.Conclusion} Case
   * @param {[string|number, API.RuleRecursion<Case>]} source
   * @param {Rule<Case>} rule
   */
  static build([name, { match, where }], rule) {
    const premise = And.analyze(where)
    const output = new Set()
    const input = new Set()
    const forwards = new Set()

    // Verify that all the variable that are recursively applied are bound.
    // Variable may be bound either by the rule's `case` or be local and bound
    // by the rule's `where` clause.
    for (const [at, term] of Object.entries(match)) {
      if (Variable.is(term)) {
        const id = Variable.id(term)
        if (rule.bindings.has(id)) {
          forwards.add(id)
        }
        // If variable is local it must be bound by the rule's where clause
        // (contained by `premise.output`) or it must be bound by the rule
        // (checked above). If neither is the case we are applying unbound
        // variable which is not allowed.
        else if (!premise.output.has(id)) {
          throw new ReferenceError(
            `Rule recursively applies ${at} relation with an unbound ${term} variable`
          )
        }
      }
    }

    // Verify that all the relations declared by the rule are bound by the
    // recursion. At the same time we populate input and output variable sets
    for (const [at, variable] of Object.entries(rule.relation)) {
      const id = Variable.id(variable)
      // If variable is written by the `where` clause it must be considered an
      // output produced by the recursion.
      if (premise.output.has(id)) {
        output.add(id)
      }
      // If variable is read by the `where` clause it must be considered as
      // input of this recursion.
      else if (premise.input.has(id)) {
        input.add(id)
      }
      // If variable is neither written nor read, nor forwarded by the
      // application it is considered unbound and that is an error.
      else if (!forwards.has(id)) {
        throw new ReferenceError(
          `Inductive rule application "${name}" does not bind "${at}" relation`
        )
      }
    }

    // Verify that `where` clause has no unbound input variable. Since input
    // contains subset of premise inputs it can only occur when premise has
    // more inputs therefor we avoid iteration unless that is the case.
    if (input.size < premise.input.size) {
      for (const id of premise.input) {
        if (!input.has(id)) {
          throw new ReferenceError(
            `Unbound ${id} variable referenced from recursive rule application`
          )
        }
      }
    }

    // If we got this far we have a recursive application of the rule
    // where all the variable are bound and accounted for.
    return new this(
      match,
      Effects.new({ loop: [{}] }).merge(premise.effects),
      premise,
      input,
      output,
      rule
    )
  }

  /**
   *
   * @param {API.RuleBindings<Case>} match
   * @param {API.Effects} effects
   * @param {And} premise
   * @param {Set<API.VariableID>} input
   * @param {Set<API.VariableID>} output
   * @param {Rule<Case>} rule
   */
  constructor(match, effects, premise, input, output, rule) {
    this.match = match
    this.effects = effects
    this.premise = premise
    this.rule = rule
    this.input = input
    this.output = output
  }

  /**
   * @param {Context} context
   * @returns {InductionPlan<Case>|Unplannable}
   */
  plan(context) {
    const missingInputs = [...this.input].filter(
      (v) => !context.bindings.has(v)
    )

    if (missingInputs.length > 1) {
      return new Unplannable(new Set(missingInputs))
    }

    const plan = this.premise.plan(context)

    if (plan.error) {
      return plan
    } else {
      return new InductionPlan(
        plan.cost + RECURSION_COST,
        this.match,
        plan,
        this
      )
    }
  }
}

/**
 * @template {API.Conclusion} [Case=API.Conclusion]
 */
class InductionPlan {
  /** @type {undefined} */
  error
  /**
   * @param {number} cost
   * @param {API.RuleBindings} match
   * @param {AndPlan} plan
   * @param {Induction<Case>} application
   */
  constructor(cost, match, plan, application) {
    this.cost = cost
    this.match = match
    this.plan = plan
    this.application = application
  }
  /**
   * @param {API.EvaluationContext} context
   */
  evaluate({ source, selection }) {
    return evaluateRule(source, this.application, selection)
  }

  toJSON() {
    return {
      Recur: {
        match: this.match,
        where: this.plan.toJSON().And,
      },
    }
  }
}

/**
 * @param {Map<API.VariableID, Set<API.VariableID>>} dependencies
 * @param {Iterable<API.VariableID>} from
 * @param {Iterable<API.VariableID>} to
 */
const depend = (dependencies, from, to) => {
  for (const source of from) {
    for (const target of to) {
      const requirements = dependencies.get(source)
      if (requirements) {
        requirements.add(target)
      } else {
        const requirements = new Set([target])
        dependencies.set(source, requirements)
      }
    }
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

const NONE = /** @type {never[]} */ (Object.freeze([]))
class Effects {
  /** @type {API.Effects} */
  static none = Object.freeze(new Effects(NONE, NONE))
  /**
   * @param {object} source
   * @param {API.QueryEffect[]} [source.query]
   * @param {API.LoopEffect[]} [source.loop]
   */
  static new({ loop, query } = {}) {
    return new this(query, loop)
  }
  /**
   * @param {object} source
   * @param {API.QueryEffect[]} [source.query]
   * @param {API.LoopEffect[]} [source.loop]
   * @returns {API.Effects}
   */
  static build({ loop = NONE, query = NONE }) {
    return new this(query, loop)
  }
  /**
   *
   * @returns {API.Effects}
   */
  build() {
    return this
  }
  /**
   * @param {API.QueryEffect[]} query
   * @param {API.LoopEffect[]} loop
   */
  constructor(query = [], loop = []) {
    this.query = query
    this.loop = loop
  }
  /**
   * @param {API.Effects} other
   */
  merge({ loop, query }) {
    if (loop) {
      this.loop.push(...loop)
    }

    if (query) {
      this.query.push(...query)
    }

    return this
  }
}
