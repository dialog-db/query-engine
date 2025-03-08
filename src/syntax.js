import * as API from './api.js'
import * as Analyzer from './analyzer.js'
import $ from './$.js'
import { Callable } from './schema/callable.js'

export { loop } from './analyzer.js'

export const Fact = Object.assign(
  /**
   * @template {API.Select} Select
   * @param {Select} selector
   */
  (selector) => ({ match: selector, fact: {} }),
  {
    /**
     * @template {API.Select} Select
     * @param {Select} selector
     */
    not: (selector) => ({ not: Fact(selector) }),
  }
)

/**
 * @template I, O
 * @param {(input: I) => O} formula
 */
const Operator = (formula) =>
  Object.assign(formula, {
    /**
     * @param {I} variables
     * @returns {{not: O}}
     */
    not: (variables) => ({
      not: formula(variables),
    }),
  })

export class Text {
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.this
   * @param {API.Term<string>} terms.like
   */
  static match = Operator(({ this: text, like }) => {
    return {
      match: { text, pattern: like },
      operator: /** @type {const} */ ('text/like'),
    }
  })
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.this
   * @param {API.Term<string>} terms.slice
   */
  static includes({ this: source, slice }) {
    return {
      match: { this: source, slice },
      operator: /** @type {const} */ ('text/includes'),
    }
  }
  /**
   * @param {object} terms
   * @param {[left:API.Term<string>, right: API.Term<string>]} terms.of
   * @param {API.Term<string>} [terms.is]
   * @returns {API.SystemOperator}
   */
  static Concat({ of: [left, right], is }) {
    return {
      match: { of: left, with: right, is },
      operator: /** @type {const} */ ('text/concat'),
    }
  }

  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.of
   * @param {API.Term<string>} [terms.is]
   */
  static Words({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('text/words'),
    }
  }
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.of
   * @param {API.Term<string>} [terms.is]
   */
  static Lines({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('text/lines'),
    }
  }
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.of
   * @param {API.Term<string>} [terms.is]
   */
  static UpperCase({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('text/case/upper'),
    }
  }
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.of
   * @param {API.Term<string>} [terms.is]
   *
   */
  static LowerCase({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('text/case/lower'),
    }
  }
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.of
   * @param {API.Term<string>} [terms.is]
   */
  static Trim({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('text/trim'),
    }
  }
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.of
   * @param {API.Term<string>} [terms.is]
   */
  static TrimStart({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('text/trim/start'),
    }
  }
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.of
   * @param {API.Term<string>} [terms.is]
   */
  static TrimEnd({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('text/trim/end'),
    }
  }
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.of
   * @param {API.Term<number>} [terms.is]
   */
  static Length({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('text/length'),
    }
  }
}

export class UTF8 {
  /**
   * @param {object} terms
   * @param {API.Term<Uint8Array>} terms.of
   * @param {API.Term<string>} [terms.is]
   * @returns {API.SystemOperator}
   */
  static ToText({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('utf8/to/text'),
    }
  }

  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.of
   * @param {API.Term<Uint8Array>} [terms.is]
   * @returns {API.SystemOperator}
   */
  static FromText({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('text/to/utf8'),
    }
  }
}

export class Data {
  /**
   * @template {API.Scalar} This
   * @template {API.Scalar} As
   * @param {object} terms
   * @param {API.Term<This>} terms.this
   * @param {API.Term<As>} [terms.as]
   * @returns {API.SystemOperator}
   */
  static same({ this: of, as }) {
    return /** @type {API.SystemOperator} */ ({
      match: { of, is: as },
      operator: /** @type {const} */ ('=='),
    })
  }

  /**
   * @template {number|string} T
   * @param {object} terms
   * @param {API.Term<T>} terms.this
   * @param {API.Term<T>} terms.than
   * @returns {API.SystemOperator}
   */
  static greater(terms) {
    return {
      match: terms,
      operator: /** @type {const} */ ('>'),
    }
  }
  static ['>'] = this.greater

  /**
   * @template {number|string} T
   * @param {object} terms
   * @param {API.Term<T>} terms.this
   * @param {API.Term<T>} terms.than
   * @returns {API.SystemOperator}
   */
  static greaterOrEqual(terms) {
    return {
      match: terms,
      operator: /** @type {const} */ ('>='),
    }
  }
  static ['>='] = this.greaterOrEqual

  /**
   * @template {number|string} T
   * @param {object} terms
   * @param {API.Term<T>} terms.this
   * @param {API.Term<T>} terms.than
   * @returns {API.SystemOperator}
   */
  static less(terms) {
    return {
      match: terms,
      operator: /** @type {const} */ ('<'),
    }
  }
  static ['<'] = this.less

  /**
   * @template {number|string} T
   * @param {object} terms
   * @param {API.Term<T>} terms.this
   * @param {API.Term<T>} terms.than
   * @returns {API.SystemOperator}
   */
  static lessOrEqual(terms) {
    return {
      match: terms,
      operator: /** @type {const} */ ('<='),
    }
  }

  static ['<='] = this.lessOrEqual

  /**
   * @param {object} terms
   * @param {API.Term<API.Scalar>} terms.of
   * @param {API.Term<API.TypeName>|API.Term<string>} [terms.is]
   * @returns {API.SystemOperator}
   */
  static Type({ of, is }) {
    return /** @type {API.SystemOperator} */ ({
      match: { of, is },
      operator: /** @type {const} */ ('data/type'),
    })
  }

  /**
   * @param {object} terms
   * @param {API.Term<any>} terms.of
   * @param {API.Term<API.Entity>} [terms.is]
   */
  static Reference({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('data/refer'),
    }
  }
}

export class Math {
  /**
   * @param {object} terms
   * @param {API.Term<API.Numeric>} terms.of
   * @param {API.Term<API.Numeric>} terms.with
   * @param {API.Term<API.Numeric>} [terms.is]
   * @returns {API.SystemOperator}
   */
  static Sum({ of, with: by, is }) {
    return /** @type {API.SystemOperator} */ ({
      match: { of, with: by, is },
      operator: /** @type {const} */ ('+'),
    })
  }
  static ['+'] = this.Sum

  /**
   * @param {object} terms
   * @param {API.Term<API.Numeric>} terms.of
   * @param {API.Term<API.Numeric>} terms.by
   * @param {API.Term<API.Numeric>} [terms.is]
   * @returns {API.SystemOperator}
   */
  static Subtraction(terms) {
    return /** @type {API.SystemOperator} */ ({
      match: terms,
      operator: /** @type {const} */ ('-'),
    })
  }
  static ['-'] = this.Subtraction

  /**
   * @param {object} terms
   * @param {API.Term<API.Numeric>} terms.of
   * @param {API.Term<API.Numeric>} terms.by
   * @param {API.Term<API.Numeric>} [terms.is]
   * @returns {API.SystemOperator}
   */
  static Multiplication(terms) {
    return /** @type {API.SystemOperator} */ ({
      match: terms,
      operator: /** @type {const} */ ('*'),
    })
  }
  static ['*'] = this.Multiplication

  /**
   * @param {object} terms
   * @param {API.Term<API.Numeric>} terms.of
   * @param {API.Term<API.Numeric>} terms.by
   * @param {API.Term<API.Numeric>} [terms.is]
   * @returns {API.SystemOperator}
   */
  static Division(terms) {
    return /** @type {API.SystemOperator} */ ({
      match: terms,
      operator: /** @type {const} */ ('/'),
    })
  }
  static ['/'] = this.Division

  /**
   * @param {object} terms
   * @param {API.Term<API.Numeric>} terms.of
   * @param {API.Term<API.Numeric>} terms.by
   * @param {API.Term<API.Numeric>} [terms.is]
   * @returns {API.SystemOperator}
   */
  static Modulo(terms) {
    return /** @type {API.SystemOperator} */ ({
      match: terms,
      operator: /** @type {const} */ ('%'),
    })
  }
  static ['%'] = this.Modulo

  /**
   * @param {object} terms
   * @param {API.Term<API.Numeric>} terms.of
   * @param {API.Term<API.Numeric>} terms.exponent
   * @param {API.Term<API.Numeric>} [terms.is]
   * @returns {API.SystemOperator}
   */
  static Power({ of, exponent, is }) {
    return /** @type {API.SystemOperator} */ ({
      match: { of, by: exponent, is },
      operator: /** @type {const} */ ('**'),
    })
  }
  static ['**'] = this.Power

  /**
   * @param {object} terms
   * @param {API.Term<API.Numeric>} terms.of
   * @param {API.Term<API.Numeric>} [terms.is]
   * @returns {API.SystemOperator}
   */
  static Absolute({ of, is }) {
    return /** @type {API.SystemOperator} */ ({
      match: { of, is },
      operator: /** @type {const} */ ('math/absolute'),
    })
  }
}

/**
 * @template {API.RuleDescriptor} Descriptor
 * @param {Descriptor} descriptor
 */
export const assert = (descriptor) => new RuleBuilder(descriptor, {})

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
   * @param {(variables: API.InferRuleVariables<Descriptor & Locals> & { _: API.Variable<any> }) => Iterable<API.Conjunct|API.MatchView<unknown>>} derive
   * @returns {Rule<Descriptor, Locals>}
   */
  when(derive) {
    const variables = RuleBuilder.buildMatch({
      ...this.locals,
      ...this.descriptor,
    })
    const when = []
    for (const each of derive({ ...variables, _: $._ })) {
      if (Symbol.iterator in each) {
        for (const conjunct of each) {
          when.push(conjunct)
        }
      } else {
        when.push(each)
      }
    }

    return new Rule(
      this.descriptor,
      this.locals,
      /** @type {[API.Conjunct, ...API.Conjunct[]]} */ (when)
    )
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
   * @param {API.Every} when
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
   * @param {(variables: API.InferRuleVariables<Descriptor & Locals> & { _: API.Variable<any> }) => Iterable<API.Conjunct|API.MatchView<unknown>>} derive
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

    const when = [...this.source.when]

    for (const each of derive(variables)) {
      if (Symbol.iterator in each) {
        for (const conjunct of each) {
          when.push(conjunct)
        }
      } else {
        when.push(each)
      }
    }

    return new Rule(
      this.descriptor,
      this.locals,
      /** @type {[API.Conjunct, ...API.Conjunct[]]} */ (when)
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
