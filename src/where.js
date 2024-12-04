import * as API from './api.js'
import * as Formula from './formula.js'
import * as Case from './case.js'

/**
 * Analyzes dependencies between variables and estimates execution cost
 * to produce a more efficient query plan.
 *
 * @param {API.Clause[]} conjuncts
 */
export const plan = (conjuncts) => {
  // First flatten all And clauses as before
  const flattened = flatten(conjuncts)

  // Track which variables are bound by each clause
  const analysis = new Map()

  // Initialize clause info with bound variables and estimated costs
  for (const clause of flattened) {
    analysis.set(clause, analyzeClause(clause))
  }

  const steps = []
  /** @type {Set<API.Clause>} */
  const remaining = new Set(flattened)
  /** @type {Set<API.VariableID>} */
  const bound = new Set()

  // Keep selecting best clause until all are placed
  while (remaining.size > 0) {
    const next = selectBestClause(remaining, bound, analysis)
    steps.push(next)
    remaining.delete(next)

    // Update bound variables for next iteration
    const { binds } = analysis.get(next)
    for (const variable of binds) {
      bound.add(variable)
    }
  }

  return steps
}

/**
 * Flattens nested And clauses
 * @param {API.Clause[]} conjuncts
 */
const flatten = (conjuncts) => {
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
 * Analyzes a clause to determine:
 * - Which variables it needs bound (dependencies)
 * - Which variables it will bind (binds)
 * - Estimated selectivity/cost
 *
 * @param {API.Clause} clause
 * @returns {API.Analysis}
 */
const analyzeClause = (clause) => {
  if (clause.Case) {
    return Case.analyze(clause.Case)
  } else if (clause.Match) {
    return Formula.analyze(clause.Match)
  } else if (clause.Not) {
    return analyzeNot(clause.Not)
  } else if (clause.Rule) {
    return analyzeRule(clause.Rule)
  } else if (clause.Or) {
    return analyzeOr(clause.Or)
  }
  return { dependencies: new Set(), binds: new Set(), cost: Infinity }
}

/**
 * Analyzes Not clauses
 *
 * @param {API.Clause} clause
 */
const analyzeNot = (clause) => {
  const { cost, dependencies } = analyzeClause(clause)
  return {
    dependencies, // Not needs all variables bound
    binds: new Set(), // Not doesn't bind new variables
    cost: cost * 2, // Negation typically more expensive
  }
}

/**
 * Analyzes Rule clauses
 * @param {API.MatchRule} rule
 */
const analyzeRule = (rule) => {
  // Rules are complex - need careful analysis
  // This is simplified for now
  return {
    dependencies: new Set(),
    binds: new Set(),
    cost: 100, // Rules are relatively expensive
  }
}

/**
 * Analyzes Or clauses
 * @param {API.Clause[]} branches
 */
const analyzeOr = (branches) => {
  // Verify all branches bind the same variables
  const [first, ...rest] = branches
  let { dependencies, cost, binds } = analyzeClause(first)
  for (const branch of rest) {
    const analysis = analyzeClause(branch)
    if (!equalSets(binds, analysis.binds)) {
      throw new OrBindingMismatchError(
        { clause: first, binds },
        {
          clause: branch,
          binds: analysis.binds,
        }
      )
    }

    for (const dependency of dependencies) {
      dependencies.add(dependency)
    }

    cost += analysis.cost
  }

  return {
    dependencies,
    binds,
    cost,
  }
}

/**
 * @template T
 * @param {Set<T>} expected
 * @param {Set<T>} actual
 */
const equalSets = (expected, actual) =>
  expected.size === expected.size && [...expected].every(($) => actual.has($))

/**
 * Error thrown when Or branches have mismatched variable bindings
 */
class OrBindingMismatchError extends Error {
  /**
   * @param {{clause: API.Clause, binds: Set<API.VariableID>}} expected
   * @param {{clause: API.Clause, binds: Set<API.VariableID>}} actual
   */
  constructor(expected, actual) {
    const missing = [...actual.binds].filter((x) => !expected.binds.has(x))
    const extra = [...expected.binds].filter((x) => !actual.binds.has(x))

    super(
      `All branches of Or clause must bind same set of variables. ` +
        `Branch ${JSON.stringify(actual)} does not bind: ${missing.join(
          ', '
        )}, ` +
        `while branch ${JSON.stringify(expected)} does not bind [${extra.join(
          ', '
        )}]`
    )
  }
}

/**
 * Selects the best next clause to execute based on:
 * - Which variables are already bound
 * - Estimated cost of execution
 * - Which new variables it will bind for future clauses
 *
 * @param {Set<API.Clause>} remaining
 * @param {Set<number>} bound
 * @param {Map<API.Clause, API.Analysis>} analysis
 * @returns {API.Clause}
 */
const selectBestClause = (remaining, bound, analysis) => {
  let bestClause = null
  let bestScore = Infinity

  if (remaining.size === 0) {
    throw new RangeError('No remaining clauses to select from')
  }

  for (const clause of remaining) {
    const { dependencies, binds, cost } = /** @type {API.Analysis} */ (
      analysis.get(clause)
    )

    // Calculate percentage of dependencies met
    const dependenciesMet = [...dependencies].filter((d) => bound.has(d)).length
    const dependencyRatio = dependencies.size
      ? dependenciesMet / dependencies.size
      : 1

    // Calculate how many new variables this will bind
    const newBinds = [...binds].filter((b) => !bound.has(b)).length

    // Score based on combination of:
    // - How many dependencies are met (higher is better)
    // - Cost (lower is better)
    // - New bindings (higher is better)
    const score = cost / (dependencyRatio * (newBinds + 1))

    if (score < bestScore) {
      bestScore = score
      bestClause = clause
    }
  }

  return /** @type {API.Clause} */ (bestClause)
}
