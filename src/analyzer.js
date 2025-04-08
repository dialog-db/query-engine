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
 * @template {API.SystemOperator} Source
 * @param {Source['operator']} operator
 * @param {Source['match']} match
 */
export const apply = (operator, match) =>
  FormulaApplication.from(/** @type {Source} */ ({ operator, match }))

/**
 * @param {API.Conjunct|API.Recur} source
 */
export const from = (source) => {
  if (source.not) {
    return Not.from(source)
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
   * @param {API.Scope} scope
   */
  constructor(selector, cells, scope = Scope.free) {
    this.cells = cells
    this.selector = selector
    this.scope = scope
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
   * @template {API.Scalar} T
   * @param {API.Scope} scope
   * @param {API.Term<T>} term
   * @returns {API.Term<T>}
   */
  static resolve(scope, term) {
    if (Variable.is(term)) {
      return /** @type {API.Term<T>} */ (scope.references.get(term)) ?? term
      // return Scope.resolve(scope, term) ?? term
    } else {
      return term
    }
  }
  /**
   *
   * @param {API.Scope} context
   */
  plan(context) {
    return new Select(this.selector, this.cells, context)
  }

  /**
   * @template {API.Scalar} T
   * @param {API.Term<T>|undefined} term
   * @param {API.MatchFrame} bindings
   * @returns {API.Term<T>|undefined}
   */
  resolve(term, bindings) {
    if (Variable.is(term)) {
      const reference = this.scope ? Scope.resolve(this.scope, term) : term
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
    const { selector, scope } = this
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
            Scope.write(scope, the, attribute, match)
          }

          if (Variable.is(of)) {
            Scope.write(scope, of, entity, match)
          }

          if (Variable.is(is)) {
            Scope.write(scope, is, value, match)
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
   * @param {API.Scope} scope
   */
  constructor(source, cells, from, to, scope = Scope.free) {
    this.cells = cells
    this.source = source
    this.from = from
    this.to = to
    this.scope = scope
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
    return new FormulaApplication(
      this.source,
      this.cells,
      this.from,
      this.to,
      scope
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
      Term.is(terms) ? Scope.lookup(this.scope, terms, bindings)
      : Array.isArray(terms) ?
        terms.map((term) => Scope.lookup(this.scope, term, bindings))
      : Object.fromEntries(
          Object.entries(terms).map(([key, term]) => [
            key,
            Scope.lookup(this.scope, term, bindings),
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
              Scope.merge(this.scope, cell, extension[key], match)
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
   * @param {API.MatchRule<Match>} source
   * @returns {RuleApplication<Match>}
   */
  static from(source) {
    // Build the underlying rule first
    const rule = DeductiveRule.from(source.rule)

    return this.apply(rule, source.match)
  }
  /**
   * @template {API.Conclusion} Match
   * @param {DeductiveRule<Match>} rule
   * @param {Partial<API.RuleBindings<Match>>} terms
   */
  static apply(rule, terms) {
    const application = new this(terms, rule)
    const { scope, cells } = application

    // Track all variables that need to be connected from inner to outer scope
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

        // Connect the inner rule variable to the outer application variable
        Scope.link(scope, inner, term)
      }
      // If value for the term is provided we create a binding.
      else if (term !== undefined) {
        Scope.write(scope, inner, term, scope.bindings)
      }
      // Otherwise we create a reference to the `_` discarding variable.
      else {
        // createReference(context, inner, _)
      }
    }

    return application
  }
  /**
   * @param {Partial<API.RuleBindings<Match>> & {}} match
   * @param {DeductiveRule<Match>} rule
   * @param {API.Scope} scope
   * @param {Map<API.Variable, number>} cells
   */
  constructor(match, rule, scope = Scope.create(), cells = new Map()) {
    this.match = match
    this.rule = rule
    this.scope = scope
    this.cells = cells
  }

  get recurs() {
    return null
  }

  get cost() {
    return this.rule.cost
  }

  /**
   * @param {API.Scope} scope
   */
  plan(scope = Scope.free) {
    // create a copy of the provided scope for this application.
    const application = Scope.clone(this.scope)

    // And copy bindings for the references into it.
    for (const [inner, outer] of application.references) {
      const reference = Scope.resolve(scope, outer)
      let value = Scope.get(scope, reference)
      if (reference !== outer) {
        value = value ?? Scope.get(scope, inner)
        Scope.link(application, inner, reference)
      }

      if (value !== undefined) {
        Scope.set(application, inner, value)
      }
    }
    // for (const [local, remote] of application.references) {
    //   // We resolve all remote variables so that all local variables
    //   // are direct references as opposed to transitive ones.
    //   // TODO: Figure out case where we actualy need this, because it
    //   // seems to me that Scope.fork should do this.
    //   Scope.link(application, local, Scope.resolve(scope, remote))

    //   // If Variable is bound we also want assign it.
    //   const value = Scope.get(scope, local)
    //   if (value !== undefined) {
    //     Scope.set(scope, local, value)
    //   }
    // }

    return new RuleApplicationPlan(
      this.match,
      this.rule.plan(application),
      application
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
 * Creates map of variables as keys and string identifiers
 * corresponding to their names in the definition.
 *
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
  static from(source) {
    const disjuncts =
      Array.isArray(source.when) ? { where: source.when } : source.when ?? {}

    let cells = new Map()
    let recurs = false
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

      if (deduction.recurs) {
        recurs = true
      }
    }

    // If no disjuncts, all match variables are required inputs as they
    // must unify by relation.
    if (entries.length === 0) {
      for (const variable of bindings.keys()) {
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
  apply(terms = this.match) {
    return RuleApplication.apply(this, terms)
  }

  /**
   * @param {API.Scope} scope
   */
  plan(scope) {
    /** @type {Record<string, JoinPlan>} */
    const when = {}
    let cost = 0
    const disjuncts = Object.entries(this.disjuncts)
    let recursive = 0
    for (const [name, disjunct] of disjuncts) {
      const plan = disjunct.plan(scope)
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
        const variable = Scope.resolve(scope, cell)
        if (cost >= Infinity && !Scope.isBound(scope, variable)) {
          const reference =
            cell !== variable ? `${cell} referring to ${variable}` : cell
          throw new ReferenceError(
            `Rule application requires binding for ${reference} variable`
          )
        }
      }
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

    return new DeductivePlan(this.match, scope, when, cost, this.recurs)
  }

  toDebugString() {
    const disjuncts = Object.entries(this.disjuncts)
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
          Scope.write(self.scope, variable, value, bindings)
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

class Join {
  /**
   * @param {object} source
   * @param {Map<API.Variable, string>} source.bindings
   * @param {string|number} source.name
   * @param {API.Every} source.conjuncts
   */
  static from(source) {
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
    for (const member of source.conjuncts) {
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
        if (source.bindings.has(variable)) {
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

    return new this(conjuncts, cells, total, recurs, `${source.name}`)
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
   * @param {API.Scope} scope
   * @returns {JoinPlan}
   */
  plan(scope) {
    // We create copy of the context because we will be modifying it as we
    // attempt to figure out execution order.
    const local = Scope.fork(scope)
    /** @type {Map<API.Variable, Set<typeof this.conjuncts[0]>>} */
    const blocked = new Map()
    /** @type {Set<typeof this.conjuncts[0]>} */
    const ready = new Set()
    let cost = 0

    // Initial setup - check which operations are ready vs blocked
    for (const conjunct of this.conjuncts) {
      let requires = 0
      for (const [variable, cost] of conjunct.cells) {
        // We resolve the target of the cell as we may have multiple different
        // references to the same variable.
        const reference = Scope.resolve(local, variable)
        if (
          cost >= Infinity &&
          !Scope.isBound(local, reference)
          // &&
          // If it is _ we don't actually need it perhaps
          // TODO: Evaluate if this is correct ❓
          // reference !== $._
        ) {
          requires++
          const waiting = blocked.get(reference)
          if (waiting) {
            waiting.add(conjunct)
          } else {
            blocked.set(reference, new Set([conjunct]))
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
        const cost = estimate(current, local)

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
        if (!Scope.isBound(local, cell)) {
          Scope.set(local, cell, NOTHING)
        }
      }

      // No we attempt to figure out which of the blocked assertions are ready
      // for planning
      for (const [cell] of unblocked) {
        // We resolve a cell to a variable as all blocked operations are tracked
        // by resolved variables because multiple local variable may be bound to
        // same target variable.
        const variable = Scope.resolve(local, cell)
        const waiting = blocked.get(variable)
        if (waiting) {
          for (const assertion of waiting) {
            let unblock = true
            // Go over all the cells in this assertion that was blocked on this
            // variable and check if it can be planned now.
            for (const [cell, cost] of assertion.cells) {
              const variable = Scope.resolve(local, cell)
              // If cell is required and is still not available, we can't
              // unblock it yet.
              if (cost >= Infinity && !Scope.isBound(local, variable)) {
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
        if (cost >= Infinity && !Scope.isBound(local, cell)) {
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
 * @typedef {Select|FormulaApplication|RuleApplication|Not|RuleRecursion} Conjunct
 */
class Not {
  /**
   * @param {API.Negation} source
   * @returns {Not}
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

  get cost() {
    return this.constraint.cost
  }

  /**
   * @param {API.Scope} scope
   * @returns {Negate}
   */
  plan(scope) {
    return new Negate(this.constraint.plan(scope))
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
class DeductivePlan {
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
   * @param {DeductivePlan<Match>} plan
   * @param {API.Scope} scope
   */
  constructor(match, plan, scope) {
    this.match = match
    this.plan = plan
    this.scope = scope
  }

  get cost() {
    return this.plan.cost
  }

  /**
   * Helper function to create a full match combining input and output bindings
   * @param {Map<API.Variable, API.Scalar>} input
   * @param {Map<API.Variable, API.Scalar>} output
   * @param {API.Scope} scope
   * @returns {Map<API.Variable, API.Scalar>|null}
   */
  createFullMatch(input, output, scope) {
    // Create a new map starting with the input bindings
    const match = new Map(input)

    // Copy derived bindings from the output
    for (const [inner, outer] of scope.references) {
      const value = output.get(outer)
      if (value !== undefined) {
        try {
          Scope.merge(scope, outer, value, match)
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

    // Copy constant bindings from the context
    for (const [variable, value] of scope.bindings) {
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
        const value = Scope.lookup(
          this.scope,
          /** @type {API.Term} */ (term),
          input
        )

        const variable = this.plan.match[name]

        if (value !== undefined && variable !== undefined) {
          Scope.write(this.scope, variable, value, bindings)
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
        const match = this.createFullMatch(input, result, this.scope)

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
              this.scope
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
 * @param {API.Scope} [scope]
 */
const estimate = ({ cells, cost = 0 }, scope) => {
  let total = cost
  for (const [variable, cost] of cells) {
    if (scope && !Scope.isBound(scope, variable)) {
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
