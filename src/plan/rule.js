import * as API from './plan.js'
import * as LRU from '../source/lru.js'
import * as JSON from '../json.js'
import { toDebugString } from '../debug.js'
import { indent } from '../data/string/format.js'
import * as Terms from '../terms.js'
import * as Constant from '../constant.js'
import * as Match from '../match.js'

/**
 * @template {API.Proposition} [Match=API.Proposition]
 */
export class DeductiveRule {
  /**
   * @param {Match} match
   * @param {API.Scope} scope
   * @param {Record<string, API.Join>} disjuncts
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
      JSON.from(plan),
    ])
    const when = Object.fromEntries(branches)

    return branches.length === 1 && branches[0][1].length === 0 ?
        { match }
      : { match, when }
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
   * @param {API.EvaluationContext} context
   * @returns {API.Task<API.MatchFrame[], Error>}
   */
  *evaluate(context) {
    /** @type {API.MatchFrame[]} */
    const matches = []
    // Run each branch and combine results
    for (const plan of Object.values(this.disjuncts)) {
      const bindings = yield* plan.evaluate(context)
      matches.push(...bindings)
    }
    return matches
  }
}

/**
 * @template {API.Proposition} [Match=API.Proposition]
 * @extends {API.RuleApplicationPlan<Match>}
 */
export class RuleApplication {
  /**
   * @param {Partial<API.RuleBindings<Match>>} match
   * @param {API.RuleSyntax<Match>} rule
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
   * @param {API.EvaluationContext} context
   */
  *evaluate({ source, selection }) {
    // Map identity -> actual match for deduplication
    /** @type {Map<string, API.MatchFrame>} */
    const matches = new Map()
    for (const frame of selection) {
      for (const input of this.read(frame)) {
        // Create evaluation context for the main evaluation
        /** @type {API.EvaluationContext} */
        const context = {
          source,
          self: this.plan,
          selection: [input],
          recur: [], // Array for recursive steps
        }

        // First evaluate the base case
        const base = yield* this.plan.evaluate(context)

        // Process base results
        for (const output of base) {
          for (const match of this.write(frame, output)) {
            const id = identifyMatch(match)
            if (!matches.has(id)) {
              matches.set(id, match)
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

          // Process all pending recursions for this iteration
          for (const [nextBinding, origContext] of recur) {
            // Check for tautology here - before recursively evaluating
            // For patterns like Tautology(X) :- Person(X), Tautology(X)
            // We need to detect when recursion would be unproductive

            // Generate identifiers for both current context and the binding for recursion
            const nextBindingId = identifyMatch(nextBinding)
            const origContextId = identifyMatch(origContext)

            // A tautology occurs when a rule refers to itself with exactly the same bindings
            // This happens when recursion can't produce any new results
            if (nextBindingId === origContextId) {
              // This is a pure tautology - the recursive call would use the exact same bindings

              // For pure tautologies, we add the current binding as a result
              // This allows joins with other predicates (like Person) to work properly
              for (const match of this.write(frame, nextBinding)) {
                const id = identifyMatch(match)
                if (!matches.has(id)) {
                  matches.set(id, match)
                }
              }

              // Skip further recursion for this path as it would create an infinite loop
              continue
            }

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
            for (const output of stepResults) {
              for (const match of this.write(frame, output)) {
                const id = identifyMatch(match)
                if (!matches.has(id)) {
                  matches.set(id, match)
                }
              }

              // Create transitive relationships with all ancestor contexts
              const ancestorContexts = contextChains.get(nextBinding) || []
              for (const context of ancestorContexts) {
                for (const match of this.write(frame, context, output)) {
                  const id = identifyMatch(match)
                  if (!matches.has(id)) {
                    matches.set(id, match)
                  }
                }
              }
            }

            // Process new recursive steps
            for (const [newBinding] of recursiveContext.recur) {
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
    }

    return [...matches.values()]
  }

  get terms() {
    return /** @type {[string, API.Term][]} */ (Object.entries(this.match))
  }

  /**
   * @param {API.MatchFrame} frame
   */
  read(frame) {
    const input = new Map()
    // Copy any bound values from outer scope into rule scope
    // based on the mapping defined in application.match
    for (const [at, variable] of Object.entries(this.rule.match)) {
      const term = /** @type {API.Term} */ (this.match[at])
      const value = Match.get(frame, term)
      if (value !== undefined) {
        const { ok } = Match.set(input, variable, value)
        if (!ok) {
          return []
        }
      }
    }

    return [input]
  }

  /**
   * @param {API.MatchFrame} frame
   * @param {API.MatchFrame[]} outputs
   */
  write(frame, ...outputs) {
    const match = Match.clone(frame)
    next: for (const [at, variable] of Object.entries(this.rule.match)) {
      const term = /** @type {API.Term} */ (this.match[at])
      // We do not want to override frame values just add new members
      const current = Match.get(frame, term)
      if (current === undefined) {
        for (const output of outputs) {
          const value = Match.get(output, variable)
          if (value !== undefined) {
            const result = Match.unify(match, term, value)
            if (!result.ok) {
              return []
            } else {
              continue next
            }
          }
        }
        // If none of the outputs contain the term we can not
        // produce a valid frame so we return `[]`
        return []
      }
    }

    return [match]
  }

  toJSON() {
    return {
      match: this.match,
      rule: JSON.from(this.plan),
    }
  }

  /**
   * @param {object} input
   * @param {API.Querier} input.from
   */
  *query({ from: source }) {
    return yield* this.evaluate({
      source: LRU.create(source),
      self: this.plan,
      selection: [new Map()],
      recur: [], // Array for pairs of [nextBindings, originalContext]
    })

    // return new Selection(/** @type {Match} */ (this.match), frames)

    // return Selector.select(/** @type {Selector} */ (selector), frames)
    // return new Query(this.rule.match, frames)
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
 * Generate a unique identifier for a match frame
 * This is used for cycle detection in the fixed-point evaluation
 *
 * @param {API.MatchFrame} frame
 * @param {string} [context=''] - Optional context to differentiate matches in different evaluation contexts
 * @returns {string} A unique identifier for this frame
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
