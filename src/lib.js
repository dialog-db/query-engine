import * as API from './api.js'
import * as Variable from './variable.js'
import * as Rule from './rule.js'
import * as Bindings from './bindings.js'
import { Link } from './constant.js'
import * as Term from './term.js'
import { dependencies } from './dsl.js'
import * as Selector from './selector.js'
import * as Task from './task.js'
import * as Formula from './formula.js'
import * as Constant from './constant.js'
import $ from './scope.js'

export * as Var from './variable.js'
export * from './api.js'
export * as Memory from './memory.js'
export * from './dsl.js'
export * as Constant from './constant.js'
export { and, or, match, not } from './clause.js'
export { rule, match as recur } from './rule.js'
export { Rule, Task, API, Link }

const ENTITY = 0
const ATTRIBUTE = 1
const VALUE = 2

export { $ }

/**
 * @template {API.Selector} Select
 * @param {API.Querier} db
 * @param {API.Query<Select>} source
 */
export const query = (db, source) => Task.perform(evaluateQuery(db, source))

/**
 * @template {{}} Ok
 * @param {API.Transactor<Ok>} db
 * @param {API.Transaction} transaction
 */
export const transact = (db, transaction) =>
  Task.perform(db.transact(transaction))

/**
 * @template {API.Selector} Selection
 * @param {API.Querier} db
 * @param {object} source
 * @param {Selection} source.select
 * @param {Iterable<API.Clause>} source.where
 * @returns {Task.Task<API.InferBindings<Selection>[] , Error>}
 */
function* evaluateQuery(db, { select, where }) {
  const conjuncts = [...where]

  /**
   * Selected fields may not explicitly appear in the where clause. To
   * illustrate consider following example
   *
   * @example
   *
   * ```ts
   * const Movie = entity({
   *    title: Schema.string(),
   *     year: Schema.number()
   * })
   *
   * const movie = new Movie()
   * const result = query(db, {
   *    select: {
   *      title: movie.title,
   *      year: movie.year
   *  },
   *  where: [movie.year.is(2000)]
   * })
   * ```
   *
   * Query `where` does not contain any references to `movie.title` therefor
   * query engine is not going to collect corresponding facts. However since
   * we do want values for `movie.title` we will add relation per selected
   * attribute to make force engine to collect facts for them.
   *
   * 🫣 This is not ideal solution as in the example above we do use
   * `movie.year` so we do not actually need another relation here. Instead we
   * could collect missing attributes when materializing the results reducing
   * unnecessary work. However this is something that can be optimized later.
   */
  for (const variable of Selector.variables(select)) {
    for (const clause of dependencies(variable)) {
      conjuncts.push(clause)
    }
  }

  const frames = yield* evaluate(new LRUCache(db), {
    And: plan(conjuncts),
  })

  /** @type {API.InferBindings<Selection>[]} */
  const selection = []
  for (const frame of frames) {
    if (selection.length === 0) {
      selection.push(Selector.select(select, frame))
    } else {
      let joined = false
      for (const [offset, match] of selection.entries()) {
        const merged = Selector.merge(select, frame, match)
        if (merged) {
          selection[offset] = merged
          joined = true
        }
      }

      if (!joined) {
        selection.push(Selector.select(select, frame))
      }
    }
  }

  // const selection = [...matches].map((match) => Selector.select(select, match))

  return selection
}

/**
 * This is very naive query planner that does following optimizations:
 *
 * 1. It raises all the nested And clause to the top as all the conjuncts are
 *    logically And joined.
 * 2. Orders conjuncts so that Case clause with less variables will be on top
 *    reducing search space for all following conjuncts that share variables.
 *
 * @param {API.Clause[]} conjuncts
 */
export const plan = (conjuncts) => {
  const where = []
  // Raise all the nested `And` clauses to the top.
  const stack = [...conjuncts]
  while (stack.length) {
    const conjunct = stack[0]
    stack.shift()
    if (conjunct.And) {
      stack.unshift(...conjunct.And)
    } else {
      where.push(conjunct)
    }
  }

  // We rank each conjunct and order by it.
  return where.sort(compareByRank)
}

/**
 * Compares clause by rank by derived rank. Higher rank will end up at the top
 * of the list and lower rank at the bottom.
 *
 * @param {API.Clause} operand
 * @param {API.Clause} modifier
 */

const compareByRank = (operand, modifier) => rank(operand) - rank(modifier)

/**
 * Derives rank for the query conjuncts in a following order:
 *
 * - Case clause that have 0 variables (If there is no match query will select
 *   nothing)
 * - Case clause that have a single variable (This will reduces search space
 *   for all the following clause that share variable)
 * - Case clause that have two variables (This will reduce search space for
 *   all fallowing clause that share variable, but is broader search than
 *   single variable clause).
 * - And clause (We should not really encounter this because those would have
 *   being raised to the top by a {@link plan}).
 * - Or clause (This is not very intelligent and we should optimize disjuncts
 *   but keeping it simple for now).
 * - Match clause (By ranking them lower we ensure that all input variables
 *   would be bound prior to execution. We should actually check that is the
 *   case before running, but this is super naive for now).
 * - Form clause (This is kind of like `Match` that should be deprecated at
 *   this point, but we'll get there eventually).
 * - Not clause (We rank it lower as all variables need to be bound before we
 *   run negation, so we sort it lower to accomplish this).
 * - Rule clause (Rules are least flashed out and recursive, which is why
 *   running them when we have more variables bound will reduce a search space).
 * - Case clause with 3 variables (If we know nothing that is a full DB scan,
 *   so make it our last resort. This is not correct behavior as we our `Match`
 *   or `Not` clause may require bindings this would find. We MUST fix this with
 *   a more intelligent planner)
 *
 * @param {API.Clause} clause
 */
const rank = (clause) => {
  if (clause.Case) {
    const [entity, attribute, value] = clause.Case
    let rank = 10
    if (!Variable.is(entity)) {
      rank -= 4
    }
    if (!Variable.is(attribute)) {
      rank -= 3
    }
    if (!Variable.is(value)) {
      rank -= 2
    }
    // If we there are no variables rank is 1
    // If we have one variable rank will in the range of [3..5]
    // If we have two variables rank will be [6..9]
    // If all three are variables we rank it lowest as 10
    return rank
  } else if (clause.And) {
    return 11
  } else if (clause.Or) {
    return 12
  } else if (clause.Match) {
    return 13
  } else if (clause.Not) {
    return 15
  } else if (clause.Rule) {
    return 16
  } else {
    return 17
  }
}

/**
 *
 * @param {API.Querier} db
 * @param {API.Clause} query
 * @param {Iterable<API.Bindings>} frames
 * @returns {Task.Task<Iterable<API.Bindings>, Error>}
 */
export const evaluate = function* (db, query, frames = [{}]) {
  if (query.Or) {
    return yield* evaluateOr(db, query.Or, frames)
  } else if (query.And) {
    return yield* evaluateAnd(db, query.And, frames)
  } else if (query.Not) {
    return yield* evaluateNot(db, query.Not, frames)
  } else if (query.Rule) {
    return yield* evaluateRule(db, query.Rule, frames)
  } else if (query.Is) {
    return yield* evaluateIs(db, query.Is, frames)
  } else if (query.Case) {
    return yield* evaluateCase(db, query.Case, frames)
  } else if (query.Match) {
    return yield* Formula.evaluate(db, query.Match, frames)
  } else {
    throw new Error(`Unsupported query kind ${Object.keys(query)[0]}`)
  }
}

/**
 * Takes conjunct queries and frames and returns extended frames.
 *
 *
 * @param {API.Querier} db
 * @param {API.Clause[]} conjuncts
 * @param {Iterable<API.Bindings>} frames
 */
export const evaluateAnd = function* (db, conjuncts, frames) {
  for (const conjunct of conjuncts) {
    frames = yield* evaluate(db, conjunct, frames)
  }

  return frames
}

/**
 *
 * @param {API.Querier} db
 * @param {API.Clause} operand
 * @param {Iterable<API.Bindings>} frames
 */
export const evaluateNot = function* (db, operand, frames) {
  const matches = []
  for (const frame of frames) {
    if (isEmpty(yield* evaluate(db, operand, [frame]))) {
      matches.push(frame)
    }
  }
  return matches
}

/**
 * @param {Iterable<unknown>} iterable
 */
const isEmpty = (iterable) => {
  for (const _ of iterable) {
    return false
  }
  return true
}

/**
 * Takes disjunct queries and frames and returns extended frames.
 *
 * @param {API.Querier} db
 * @param {API.Clause[]} disjuncts
 * @param {Iterable<API.Bindings>} frames
 */
export const evaluateOr = function* (db, disjuncts, frames) {
  // We copy iterable here because first disjunct will consume all the frames
  // and subsequent ones will not have any frames to work with otherwise.
  frames = [...frames]
  const matches = []
  for (const query of disjuncts) {
    const bindings = yield* evaluate(db, query, frames)
    matches.push(...bindings)
  }
  return matches
}

/**
 * @param {API.Querier} _
 * @param {API.Clause['Is'] & {}} is
 * @param {Iterable<API.Bindings>} frames
 */
export const evaluateIs = function* (_, [expect, actual], frames) {
  const matches = []
  for (const bindings of frames) {
    const result = Term.unify(expect, actual, bindings)
    if (!result.error) {
      matches.push(result.ok)
    }
  }
  return matches
}

/**
 * @param {API.Querier} db
 * @param {API.Clause['Case'] & {}} pattern
 * @param {Iterable<API.Bindings>} frames
 */

export const evaluateCase = function* (db, pattern, [...frames]) {
  const matches = []
  for (const bindings of frames) {
    const resolved = Bindings.resolve(bindings, pattern)
    // Note: We expect that there will be LRUCache wrapping the db
    // so calling scan over and over again will not actually cause new scans.
    const facts = yield* iterateFacts(db, resolved)
    for (const fact of facts) {
      matches.push(...matchFact(fact, pattern, bindings))
    }
  }

  return matches
}

/**
 *
 * @param {API.Querier} db
 * @param {API.Clause['Rule'] & {}} rule
 * @param {Iterable<API.Bindings>} frames
 */
const evaluateRule = function* (db, rule, frames) {
  const matches = []
  for (const frame of frames) {
    const bindings = yield* matchRule(db, rule, frame)
    matches.push(...bindings)
  }
  return matches
}

/**
 * @param {API.Querier} db
 * @param {API.Pattern} pattern
 */
const iterateFacts = (db, [entity, attribute, value]) =>
  db.scan({
    entity: Variable.is(entity) ? undefined : entity,
    attribute: Variable.is(attribute) ? undefined : attribute,
    value: Variable.is(value) ? undefined : value,
  })

/**
 * Attempts to match given `fact` against the given `pattern`, if it matches
 * yields extended `frame` with values for all the pattern variables otherwise
 * yields no frames.
 *
 * @param {API.Fact|API.Datum} fact
 * @param {API.Pattern} pattern
 * @param {API.Bindings} bindings
 */
const matchFact = function* (fact, pattern, bindings) {
  const result = matchPattern(pattern, fact, bindings)
  if (result.ok) {
    yield result.ok
  }
}

/**
 *
 * @param {API.Pattern} pattern
 * @param {API.Fact|API.Datum} fact
 * @param {API.Bindings} bindings
 * @returns {API.Result<API.Bindings, Error>}
 */
const matchPattern = (pattern, [entity, attribute, value], bindings) => {
  let result = Term.match(pattern[ENTITY], entity, bindings)
  result =
    result.error ? result : Term.match(pattern[ATTRIBUTE], attribute, result.ok)

  result = result.error ? result : Term.match(pattern[VALUE], value, result.ok)

  return result
}

/**
 *
 * @param {API.Querier} db
 * @param {API.RuleApplication} application
 * @param {API.Bindings} bindings
 */
const matchRule = function* (db, application, bindings) {
  const matches = []
  const rule = Rule.from(application.rule)

  // Create isolated bindings for rule execution
  /** @type {API.Bindings} */
  let input = {}

  // Copy any bound values from outer scope into rule scope
  // based on the mapping defined in application.match
  const { match } = application
  for (const [at, target] of Object.entries(rule.case)) {
    const source = match[at]
    const value = Bindings.get(bindings, source)
    if (value !== undefined) {
      const result = Term.unify(target, value, input)
      if (result.error) {
        return []
      } else {
        input = result.ok
      }
    }
  }

  // Execute rule with isolated bindings
  const results = yield* evaluate(db, rule.when, [input])

  // For each result, create new outer bindings with mapped values
  for (const result of results) {
    const output = { ...bindings }
    for (const [key, source] of Object.entries(rule.case)) {
      const target = match[key]
      const value = Bindings.get(result, source)
      if (Variable.is(target) && value !== undefined) {
        output[Variable.toKey(target)] = value
      }
    }
    matches.push(output)
  }

  return matches
}

/**
 * Implements a Least Recently Used (LRU) cache for facts with a capacity limit
 * based on the total number of individual facts cached.
 */
class LRUCache {
  #size
  /**
   * @param {API.Querier} source - The underlying data source
   * @param {number} capacity - Maximum number of individual facts to store in cache
   */
  constructor(source, capacity = 10_000) {
    this.source = source
    this.capacity = capacity
    /** @type {Map<string, API.Datum[]>} */
    this.cache = new Map()
    /** @type {number} */
    this.#size = 0
  }

  /**
   * Generates a cache key from the selector components
   * @param {API.FactsSelector} selector
   * @returns {string}
   */
  static identify({ entity, attribute, value }) {
    return `${entity ? `e:${Constant.toString(entity)}` : ``}${
      attribute ? `a:${Constant.toString(attribute)}` : ``
    }${value ? `v:${Constant.toString(value)}` : ``}`
  }

  /**
   * Updates the LRU order by removing and re-adding the key
   * @param {string} key
   */
  touch(key) {
    const value = this.cache.get(key)
    if (value) {
      this.cache.delete(key)
      this.cache.set(key, value)
    }
  }

  /**
   * Evicts entries until cache is under capacity
   */
  evict() {
    for (const [key, facts] of this.cache) {
      if (this.#size <= this.capacity) {
        break
      }
      this.#size -= facts.length
      this.cache.delete(key)
    }
  }

  /**
   * @param {API.FactsSelector} selector
   */
  *scan({ entity, attribute, value }) {
    const key = LRUCache.identify({ entity, attribute, value })

    // Check if we have it in cache
    const cached = this.cache.get(key)
    if (cached) {
      this.touch(key)
      return cached
    }

    // Fetch from source
    const facts = yield* this.source.scan({ entity, attribute, value })

    // Skip caching if the result set is larger than our total capacity
    if (facts.length > this.capacity) {
      return facts
    }

    // Add to cache
    this.cache.set(key, facts)
    this.#size += facts.length

    // Evict if we're over capacity
    if (this.#size > this.capacity) {
      this.evict()
    }

    return facts
  }

  /**
   * Clears the cache
   */
  clear() {
    this.cache.clear()
    this.#size = 0
  }

  /**
   * Returns current number of cached facts
   */
  size() {
    return this.#size
  }

  /**
   * Returns the number of cached queries
   */
  get count() {
    return this.cache.size
  }
}
