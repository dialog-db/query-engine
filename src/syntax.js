import * as API from './api.js'
import * as Analyzer from './analyzer.js'
import $ from './$.js'
import { Callable } from './schema/callable.js'

export { loop } from './analyzer.js'

/**
 * @template Terms
 * @template {(terms: any) => API.Constraint} F
 * @extends {Callable<F>}
 */
export class Operator extends Callable {
  /**
   * @template Terms
   * @template {(terms: Terms) => API.Constraint} Formula
   * @param {Formula} match
   * @returns {Operator<Terms, Formula>}
   */
  static for(match) {
    return new this(match)
  }
  /**
   * @param {F} match
   */
  constructor(match) {
    super(match)
    this.match = match
  }

  /**
   * @param {Terms} terms
   * @returns {API.Negation}
   */
  not(terms) {
    return { not: this.match(terms) }
  }
}

export const Fact = Operator.for(
  /**
   * @template {API.Select} Select
   * @param {Select} terms
   * @returns {{match: Select, fact: {}}}
   */
  (terms) => ({ match: terms, fact: {} })
)

/**
 * @param {API.Term<string>} term
 */
export const text = (term) => new TextVariable(term)

class TextVariable {
  #this
  /**
   * @param {API.Term<string>} term
   */
  constructor(term) {
    this.#this = term
  }

  /**
   * @param {API.Term<string>} pattern
   */
  like(pattern) {
    return Text.match({ this: this.#this, pattern: pattern })
  }

  /**
   * @param {API.Term<string>} slice
   */
  includes(slice) {
    return Text.includes({ this: this.#this, slice })
  }

  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.with
   * @param {API.Term<string>} terms.is
   */
  concat(terms) {
    return Text.Concat({ of: [this.#this, terms.with], is: terms.is })
  }

  words() {
    const of = this.#this
    return {
      /**
       * @param {API.Term<string>} is
       */
      is(is) {
        return Text.Words({ of, is })
      },
    }
  }

  lines() {
    const of = this.#this
    return {
      /**
       * @param {API.Term<string>} is
       */
      is(is) {
        return Text.Lines({ of, is })
      },
    }
  }

  toUpperCase() {
    const of = this.#this
    return {
      /**
       * @param {API.Term<string>} is
       */
      is(is) {
        return Text.UpperCase({ of, is })
      },
      /**
       * @param {API.Term<string>} is
       */
      not(is) {
        return { not: Text.UpperCase({ of, is }) }
      },
    }
  }

  /**
   */
  toLowerCase() {
    const of = this.#this
    return {
      /**
       * @param {API.Term<string>} is
       */
      is(is) {
        return Text.LowerCase({ of, is })
      },
      /**
       * @param {API.Term<string>} is
       */
      not(is) {
        return { not: Text.LowerCase({ of, is }) }
      },
    }
  }

  /**
   * @param {API.Term<string>} is
   */
  trim(is) {
    return Text.Trim({ of: this.#this, is })
  }
}

export class Text {
  #this
  /**
   * @param {API.Term<string>} source
   */
  constructor(source) {
    this.#this = source
  }

  static match = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<string>} terms.this
     * @param {API.Term<string>} terms.pattern
     */
    ({ this: text, pattern: like }) => ({
      match: { text, pattern: like },
      operator: /** @type {const} */ ('text/like'),
    })
  )

  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.this
   * @param {API.Term<string>} terms.pattern
   */
  static not(terms) {
    return { not: this.match(terms) }
  }

  static includes = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<string>} terms.this
     * @param {API.Term<string>} terms.slice
     */
    ({ this: source, slice }) => {
      return {
        match: { this: source, slice },
        operator: /** @type {const} */ ('text/includes'),
      }
    }
  )

  static Concat = Operator.for(
    /**
     * @param {object} terms
     * @param {[left:API.Term<string>, right: API.Term<string>]} terms.of
     * @param {API.Term<string>} [terms.is]
     * @returns {API.SystemOperator}
     */
    ({ of: [left, right], is }) => {
      return {
        match: { of: left, with: right, is },
        operator: /** @type {const} */ ('text/concat'),
      }
    }
  )

  static Words = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<string>} terms.of
     * @param {API.Term<string>} [terms.is]
     */
    ({ of, is }) => {
      return {
        match: { of, is },
        operator: /** @type {const} */ ('text/words'),
      }
    }
  )

  static Lines = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<string>} terms.of
     * @param {API.Term<string>} [terms.is]
     */
    ({ of, is }) => {
      return {
        match: { of, is },
        operator: /** @type {const} */ ('text/lines'),
      }
    }
  )

  static UpperCase = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<string>} terms.of
     * @param {API.Term<string>} [terms.is]
     */
    ({ of, is }) => {
      return {
        match: { of, is },
        operator: /** @type {const} */ ('text/case/upper'),
      }
    }
  )

  static LowerCase = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<string>} terms.of
     * @param {API.Term<string>} [terms.is]
     *
     */
    ({ of, is }) => {
      return {
        match: { of, is },
        operator: /** @type {const} */ ('text/case/lower'),
      }
    }
  )

  static Trim = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<string>} terms.of
     * @param {API.Term<string>} [terms.is]
     */
    ({ of, is }) => {
      return {
        match: { of, is },
        operator: /** @type {const} */ ('text/trim'),
      }
    }
  )

  static TrimStart = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<string>} terms.of
     * @param {API.Term<string>} [terms.is]
     */
    ({ of, is }) => {
      return {
        match: { of, is },
        operator: /** @type {const} */ ('text/trim/start'),
      }
    }
  )

  static TrimEnd = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<string>} terms.of
     * @param {API.Term<string>} [terms.is]
     */
    ({ of, is }) => {
      return {
        match: { of, is },
        operator: /** @type {const} */ ('text/trim/end'),
      }
    }
  )

  static Length = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<string>} terms.of
     * @param {API.Term<number>} [terms.is]
     */
    ({ of, is }) => {
      return {
        match: { of, is },
        operator: /** @type {const} */ ('text/length'),
      }
    }
  )
}

export class UTF8 {
  static ToText = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<Uint8Array>} terms.of
     * @param {API.Term<string>} [terms.is]
     * @returns {API.SystemOperator}
     */
    ({ of, is }) => {
      return {
        match: { of, is },
        operator: /** @type {const} */ ('utf8/to/text'),
      }
    }
  )

  static FromText = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<string>} terms.of
     * @param {API.Term<Uint8Array>} [terms.is]
     * @returns {API.SystemOperator}
     */
    ({ of, is }) => {
      return {
        match: { of, is },
        operator: /** @type {const} */ ('text/to/utf8'),
      }
    }
  )
}

export class Data {
  static same = Object.assign(
    /**
     * @template {API.Scalar} This
     * @template {API.Scalar} As
     * @param {object} terms
     * @param {API.Term<This>} terms.this
     * @param {API.Term<As>} [terms.as]
     * @returns {API.SystemOperator}
     */
    ({ this: of, as }) => {
      return /** @type {API.SystemOperator} */ ({
        match: { of, is: as },
        operator: /** @type {const} */ ('=='),
      })
    },
    {
      /**
       * @template {API.Scalar} This
       * @template {API.Scalar} As
       * @param {object} terms
       * @param {API.Term<This>} terms.this
       * @param {API.Term<As>} [terms.as]
       * @returns {API.Negation}
       */
      not: (terms) => ({ not: Data.same(terms) }),
    }
  )

  static greater = Operator.for(
    /**
     * @template {number|string} T
     * @param {object} terms
     * @param {API.Term<T>} terms.this
     * @param {API.Term<T>} terms.than
     * @returns {API.SystemOperator}
     */
    (terms) => {
      return {
        match: terms,
        operator: /** @type {const} */ ('>'),
      }
    }
  )
  static ['>'] = this.greater

  static greaterOrEqual = Operator.for(
    /**
     * @template {number|string} T
     * @param {object} terms
     * @param {API.Term<T>} terms.this
     * @param {API.Term<T>} terms.than
     * @returns {API.SystemOperator}
     */
    (terms) => {
      return {
        match: terms,
        operator: /** @type {const} */ ('>='),
      }
    }
  )
  static ['>='] = this.greaterOrEqual

  static less = Operator.for(
    /**
     * @template {number|string} T
     * @param {object} terms
     * @param {API.Term<T>} terms.this
     * @param {API.Term<T>} terms.than
     * @returns {API.SystemOperator}
     */
    (terms) => {
      return {
        match: terms,
        operator: /** @type {const} */ ('<'),
      }
    }
  )
  static ['<'] = this.less

  static lessOrEqual = Operator.for(
    /**
     * @template {number|string} T
     * @param {object} terms
     * @param {API.Term<T>} terms.this
     * @param {API.Term<T>} terms.than
     * @returns {API.SystemOperator}
     */
    (terms) => {
      return {
        match: terms,
        operator: /** @type {const} */ ('<='),
      }
    }
  )

  static ['<='] = this.lessOrEqual

  static Type = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<API.Scalar>} terms.of
     * @param {API.Term<API.TypeName>|API.Term<string>} [terms.is]
     * @returns {API.SystemOperator}
     */
    ({ of, is }) => {
      return /** @type {API.SystemOperator} */ ({
        match: { of, is },
        operator: /** @type {const} */ ('data/type'),
      })
    }
  )

  static Reference = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<any>} terms.of
     * @param {API.Term<API.Entity>} [terms.is]
     */
    ({ of, is }) => {
      return {
        match: { of, is },
        operator: /** @type {const} */ ('data/refer'),
      }
    }
  )
}

export class Math {
  static Sum = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<API.Numeric>} terms.of
     * @param {API.Term<API.Numeric>} terms.with
     * @param {API.Term<API.Numeric>} [terms.is]
     * @returns {API.SystemOperator}
     */
    ({ of, with: by, is }) => {
      return /** @type {API.SystemOperator} */ ({
        match: { of, with: by, is },
        operator: /** @type {const} */ ('+'),
      })
    }
  )
  static ['+'] = this.Sum

  static Subtraction = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<API.Numeric>} terms.of
     * @param {API.Term<API.Numeric>} terms.by
     * @param {API.Term<API.Numeric>} [terms.is]
     * @returns {API.SystemOperator}
     */
    (terms) => {
      return /** @type {API.SystemOperator} */ ({
        match: terms,
        operator: /** @type {const} */ ('-'),
      })
    }
  )
  static ['-'] = this.Subtraction

  static Multiplication = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<API.Numeric>} terms.of
     * @param {API.Term<API.Numeric>} terms.by
     * @param {API.Term<API.Numeric>} [terms.is]
     * @returns {API.SystemOperator}
     */
    (terms) => {
      return /** @type {API.SystemOperator} */ ({
        match: terms,
        operator: /** @type {const} */ ('*'),
      })
    }
  )
  static ['*'] = this.Multiplication

  static Division = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<API.Numeric>} terms.of
     * @param {API.Term<API.Numeric>} terms.by
     * @param {API.Term<API.Numeric>} [terms.is]
     * @returns {API.SystemOperator}
     */
    (terms) => {
      return /** @type {API.SystemOperator} */ ({
        match: terms,
        operator: /** @type {const} */ ('/'),
      })
    }
  )
  static ['/'] = this.Division

  static Modulo = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<API.Numeric>} terms.of
     * @param {API.Term<API.Numeric>} terms.by
     * @param {API.Term<API.Numeric>} [terms.is]
     * @returns {API.SystemOperator}
     */
    (terms) => {
      return /** @type {API.SystemOperator} */ ({
        match: terms,
        operator: /** @type {const} */ ('%'),
      })
    }
  )
  static ['%'] = this.Modulo

  static Power = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<API.Numeric>} terms.of
     * @param {API.Term<API.Numeric>} terms.exponent
     * @param {API.Term<API.Numeric>} [terms.is]
     * @returns {API.SystemOperator}
     */
    ({ of, exponent, is }) => {
      return /** @type {API.SystemOperator} */ ({
        match: { of, by: exponent, is },
        operator: /** @type {const} */ ('**'),
      })
    }
  )
  static ['**'] = this.Power

  static Absolute = Operator.for(
    /**
     * @param {object} terms
     * @param {API.Term<API.Numeric>} terms.of
     * @param {API.Term<API.Numeric>} [terms.is]
     * @returns {API.SystemOperator}
     */
    ({ of, is }) => {
      return /** @type {API.SystemOperator} */ ({
        match: { of, is },
        operator: /** @type {const} */ ('math/absolute'),
      })
    }
  )
}

/**
 * @template {API.RuleDescriptor} Descriptor
 * @param {Descriptor} descriptor
 */
export const deduce = (descriptor) => new RuleBuilder(descriptor, {})

/**
 * @template {API.RuleDescriptor} Descriptor
 * @template {API.RuleDescriptor} Locals
 */
class RuleBuilder {
  /**
   * @param {Descriptor} descriptor
   * @param {Locals} locals
   */
  constructor(descriptor, locals) {
    this.descriptor = descriptor
    this.locals = locals
  }

  /**
   * @returns {RuleBuilder<Descriptor, Locals>}
   */
  get this() {
    return this
  }

  /**
   * @template {API.RuleDescriptor} Variables
   * @param {Variables} variables
   * @returns {API.InferRuleVariables<Variables>}
   */
  static buildMatch(variables) {
    const match = /** @type {Record<string, API.Variable>} */ ({})
    for (const [key, type] of Object.entries(variables)) {
      match[key] = $[key]
    }

    return /** @type {API.InferRuleVariables<Variables>} */ (match)
  }

  /**
   * @template {Omit<API.RuleDescriptor, keyof Descriptor | keyof Locals>} Extension
   * @param {Extension} extension
   * @returns {RuleBuilder<Descriptor, Locals & Extension>}
   */
  with(extension) {
    return new RuleBuilder(this.descriptor, { ...extension, ...this.locals })
  }
  /**
   * @param {API.WhenBuilder<Descriptor & Locals>} derive
   * @returns {Rule<Descriptor, Locals>}
   */
  when(derive) {
    const variables = RuleBuilder.buildMatch({
      ...this.locals,
      ...this.descriptor,
    })

    const when = /** @type {Record<string, API.Every>} */ ({})
    for (const [name, disjunct] of iterateDisjuncts(
      derive({ ...variables, _: $._ })
    )) {
      const conjuncts = [...iterateConjuncts(disjunct)]
      when[name] = /** @type {[API.Conjunct, ...API.Conjunct[]]} */ (conjuncts)
    }

    return new Rule(
      this.descriptor,
      this.locals,
      /** @type {API.Some} */ (when)
    )
  }
}

/**
 * @param {API.EveryView} source
 * @returns {Iterable<API.Conjunct>}
 */
function* iterateConjuncts(source) {
  for (const member of source) {
    if (member === undefined) {
      continue
    } else if (Symbol.iterator in member) {
      for (const conjunct of member) {
        yield conjunct
      }
    } else {
      yield member
    }
  }
}

/**
 * @param {API.WhenView} source
 * @returns {Iterable<[string, API.EveryView]>}
 */
function* iterateDisjuncts(source) {
  if (Array.isArray(source)) {
    yield ['when', source]
  } else {
    yield* Object.entries(source)
  }
}

/**
 * @template {API.RuleDescriptor} Descriptor
 * @template {API.RuleDescriptor} Locals
 * @extends {Callable<(terms?: API.RuleBindings<API.InferRuleVariables<Descriptor>>) => Query<Descriptor>>}
 */
class Rule extends Callable {
  /**
   * @param {Descriptor} descriptor
   * @param {Locals} locals
   * @param {API.Some} when
   */
  constructor(descriptor, locals, when) {
    super(
      /** @type {typeof this.match} */
      (terms) => this.match(terms)
    )

    this.locals = locals
    this.descriptor = descriptor

    const source = {
      match: RuleBuilder.buildMatch(descriptor),
      when,
    }
    this.source = source
    this.form = Analyzer.rule(source)
  }

  /**
   * @param {API.WhenBuilder<Descriptor & Locals>} derive
   * @returns {Rule<Descriptor, Locals>}
   */
  when(derive) {
    const variables = {
      _: $._,
      ...RuleBuilder.buildMatch({
        ...this.locals,
        ...this.descriptor,
      }),
    }

    const base = /** @type {API.Conjunct[]} */ ([...this.match(variables)])

    const when = /** @type {Record<string, API.Every>} */ ({})
    for (const [name, disjunct] of iterateDisjuncts(derive(variables))) {
      when[name] = /** @type {[API.Conjunct, ...API.Conjunct[]]} */ ([
        ...base,
        ...iterateConjuncts(disjunct),
      ])
    }

    return new Rule(
      this.descriptor,
      this.locals,
      /** @type {API.Some} */ (when)
    )
  }

  get $() {
    return this.form.match
  }
  /**
   * @template {Partial<API.RuleBindings<API.InferRuleVariables<Descriptor>>>} Selection
   * @param {Selection} [terms]
   * @returns {Query<{[K in keyof Selection]: Descriptor[K]}>}
   */
  match(terms) {
    const match =
      /** @type {API.InferRuleVariables<{[K in keyof Selection & keyof Descriptor]: Descriptor[K]}>} */ (
        terms ?? this.form.match
      )

    return new Query(match, this)
  }

  /**
   * @template {Partial<API.RuleBindings<API.InferRuleVariables<Descriptor>>>} Selection
   * @param {Selection} [terms]
   * @returns {Query<Descriptor>}
   */
  where(terms) {
    return this.match({ ...this.form.match, ...terms })
  }
}

/**
 * @template {API.RuleDescriptor} Descriptor
 * @param {API.Every} where
 */
class Query {
  /** @type {Analyzer.RuleApplication<API.InferRuleVariables<Descriptor>>|undefined} */
  #form
  /**
   * @param {API.InferRuleVariables<Descriptor>} match
   * @param {Rule<Descriptor, {}>} rule
   */
  constructor(match, rule) {
    this.match = match
    this.rule = rule
  }

  get form() {
    if (!this.#form) {
      this.#form = this.rule.form.apply(this.match)
    }
    return this.#form
  }
  /**
   * @param {{ from: API.Querier }} source
   */
  select(source) {
    return this.form.select(source)
  }

  *[Symbol.iterator]() {
    yield {
      match: this.match,
      rule: this.rule.source,
    }
  }
}
