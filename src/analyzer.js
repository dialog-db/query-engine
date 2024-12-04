import * as API from './api.js'
import * as Variable from './variable.js'
import * as Terms from './terms.js'
import * as Entity from './entity.js'
import { evaluateCase } from './lib.js'
import { isEmpty } from './iterable.js'
import * as Formula from './formula.js'
import * as Bindings from './bindings.js'
import * as Rule from './rule.js'

/**
 * @typedef {Case|Or|And|Not|Is|Match} Branch
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
    return Rule.analyze(clause.Rule)
  } else {
    throw new Error(`Unsupported clause kind ${Object.keys(clause)[0]}`)
  }
}

/**
 * @param {(API.Clause & {plan?:undefined})|Branch} clause
 * @param {Partial<Context>} context
 */
export function plan(
  clause,
  { bindings = new Set(), scope = new Scope(new Set()) } = {}
) {
  if (clause.plan) {
    return clause.plan({ bindings, scope })
  } else {
    return analyze(clause).plan({ bindings, scope })
  }
}

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
    let cost = 1000

    if (!Variable.is(entity) || context.bindings.has(Variable.id(entity))) {
      cost *= 0.1
    }
    if (
      !Variable.is(attribute) ||
      context.bindings.has(Variable.id(attribute))
    ) {
      cost *= 0.2
    }
    if (!Variable.is(value)) {
      cost *= Entity.is(value) ? 0.1 : 0.3
    } else if (context.bindings.has(Variable.id(value))) {
      cost *= 0.1
    }

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

  /**
   * @param {Set<API.VariableID>} scope
   * @returns {number}
   */
  prioritize(scope) {
    const [entity, attribute, value] = this.pattern
    let cost = 1000

    // Reduce cost based on bound terms
    if (!Variable.is(entity) || scope.has(Variable.id(entity))) {
      cost *= 0.1
    }
    if (!Variable.is(attribute) || scope.has(Variable.id(attribute))) {
      cost *= 0.2
    }
    if (!Variable.is(value)) {
      cost *= Entity.is(value) ? 0.1 : 0.3
    } else if (scope.has(Variable.id(value))) {
      cost *= 0.1
    }

    const count = [...this.output].filter((v) => !scope.has(v)).length

    return count > 0 ? cost / count : cost
  }
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

    // Process remaining branches
    for (const disjunct of rest) {
      const current = analyze(disjunct)
      analysis.push(current)

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

    return new this(analysis, input, output, extension)
  }

  /**
   * @param {Branch[]} branches
   * @param {Set<API.VariableID>} input
   * @param {Set<API.VariableID>} output
   * @param {Set<API.VariableID>} extension
   */
  constructor(branches, input, output, extension) {
    this.branches = branches
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
   * @param {Set<API.VariableID>} input
   * @param {Set<API.VariableID>} output
   */
  constructor(binding, elimination, input, output) {
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

    // Partition steps into binding and elimination
    const binding = []
    const elimination = []

    for (const clause of conjuncts(clauses)) {
      const step = analyze(clause)
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
        if (input.has(id)) {
          input.delete(id)
        }
      }
    }

    return new this(binding, elimination, input, output)
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
      output.add(Variable.id(variable))
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

/**
 * @template T
 * @param {Set<T>} expected
 * @param {Set<T>} actual
 */
const equalSets = (expected, actual) =>
  actual.size === expected.size && [...expected].every(($) => actual.has($))

class Unplannable extends Error {
  /**
   *
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
      cost: this.cost,
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
      cost: this.cost,
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
      cost: this.cost,
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
      cost: this.cost,
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
      cost: this.cost,
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
      const result = Bindings.unify(expect, actual, bindings)
      if (!result.error) {
        matches.push(result.ok)
      }
    }
    return matches
  }

  toJSON() {
    return {
      cost: this.cost,
      Is: this.relation,
    }
  }
}

/**
 * @typedef {object} ScopeMember
 * @property {(id: API.VariableID) => boolean} has
 */

class Scope {
  /**
   * @param {Set<ScopeMember>} members
   * @param {unknown} except
   */
  constructor(members, except = null) {
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
