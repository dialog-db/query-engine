import * as API from './api.js'
import * as Variable from './variable.js'
import * as Bindings from './bindings.js'
import * as Selector from './selector.js'
import * as Relation from './formula.js'
import * as Term from './term.js'

/**
 * @param {API.Clause} clause
 * @returns {object}
 */
export const toJSON = (clause) => {
  if (clause.And) {
    return { And: clause.And.map(toJSON) }
  } else if (clause.Or) {
    return { Or: clause.Or.map(toJSON) }
  } else if (clause.Not) {
    return { Not: toJSON(clause.Not) }
  } else if (clause.Rule) {
    return {
      Rule: {
        input: Selector.toJSON(clause.Rule.input),
        rule: clause.Rule.rule && {
          match: Selector.toJSON(clause.Rule.rule?.select ?? {}),
          where: toJSON(clause.Rule.rule.where),
        },
      },
    }
  } else if (clause.Case) {
    const [entity, attribute, value] = clause.Case
    return {
      Case: [Term.toJSON(entity), Term.toJSON(attribute), Term.toJSON(value)],
    }
  } else {
    throw new Error(`Unknown clause: ${clause}`)
  }
}

/**
 * @param {API.Clause[]} clauses
 */
export const or = (...clauses) => new Or(clauses)

/**
 * @param {API.Clause[]} clauses
 */
export const and = (...clauses) => new And(clauses)

/**
 * @param {API.Clause} clause
 */
export const not = (clause) => new Not(clause)

/**
 *
 * @param {API.Pattern} pattern
 */
export const match = (pattern) => new Case(pattern)

/**
 * @param {API.Clause} query
 * @returns {Iterable<API.Variable>}
 */
export const variables = function* (query) {
  if (query.And) {
    for (const conjunct of query.And) {
      yield* variables(conjunct)
    }
  } else if (query.Or) {
    for (const disjunct of query.Or) {
      yield* variables(disjunct)
    }
  } else if (query.Not) {
    yield* variables(query.Not)
  } else if (query.Rule) {
    for (const binding of Object.values(query.Rule.input)) {
      if (Variable.is(binding)) {
        yield binding
      }
    }
  } else if (query.Is) {
    const [entity, type] = query.Is
    if (Variable.is(entity)) {
      yield entity
    }
    if (Variable.is(type)) {
      yield type
    }
  } else if (query.Case) {
    const [entity, attribute, value] = query.Case
    if (Variable.is(entity)) {
      yield entity
    }
    if (Variable.is(attribute)) {
      yield attribute
    }
    if (Variable.is(value)) {
      yield value
    }
  } else if (query.Match) {
    yield* Relation.variables(query.Match)
  }
}

/**
 * @param {API.Clause} clause
 * @param {API.Variable} variable
 * @param {API.Bindings} frame
 */
export const isDependent = (clause, variable, frame) => {
  for (const each of variables(clause)) {
    if (each === variable) {
      return true
    } else {
      const binding = Bindings.get(frame, each)
      if (binding != null) {
        // @ts-ignore - not sure how can we resolve variable to a query
        if (isDependent(binding.ok, variable, frame)) {
          return true
        }
      }
    }
  }
  return false
}

/**
 * @abstract
 */
class Clause {
  /**
   * @param {API.Clause} clause
   */
  and(clause) {
    return and(/** @type {any} */ (this), clause)
  }
  /**
   * @param {API.Clause} clause
   */
  or(clause) {
    return or(/** @type {any} */ (this), clause)
  }
}

class And extends Clause {
  /**
   * @param {API.Clause[]} clauses
   */
  constructor(clauses) {
    super()
    this.And = clauses
  }
  /**
   * @param {API.Clause} clause
   */
  and(clause) {
    return and(...this.And, clause)
  }
}

class Or extends Clause {
  /**
   * @param {API.Clause[]} clauses
   */
  constructor(clauses) {
    super()
    this.Or = clauses
  }
  /**
   * @param {API.Clause} clause
   */
  or(clause) {
    return or(...this.Or, clause)
  }
}

class Not extends Clause {
  /**
   * @param {API.Clause} clause
   */
  constructor(clause) {
    super()
    this.Not = clause
  }
}

class Case extends Clause {
  /**
   * @param {API.Pattern} pattern
   */
  constructor(pattern) {
    super()
    this.Case = pattern
  }
}
