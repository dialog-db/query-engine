import * as API from './api.js'
import * as Analyzer from './analyzer.js'
import $ from './$.js'
import { Callable } from './schema/callable.js'

export { loop } from './analyzer.js'

/**
 * @template {API.Select} Select
 * @param {Select} selector
 */
export const Fact = (selector) => ({ match: selector, fact: {} })

export class Text {
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.this
   * @param {API.Term<string>} terms.like
   */
  static match({ this: text, like }) {
    return {
      match: { text, pattern: like },
      operator: /** @type {const} */ ('text/like'),
    }
  }
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
   */
  static Conact({ of: [left, right], is }) {
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
      match: { of },
      operator: /** @type {const} */ ('text/upper/case'),
    }
  }
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.of
   * @param {API.Term<string>} [terms.is]
   */
  static LowerCase({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('text/lower/case'),
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
   * @param {object} terms
   * @param {API.Term} terms.this
   * @param {API.Term} [terms.as]
   */
  static same({ this: of, as }) {
    return {
      match: { of: of, is: as },
      operator: /** @type {const} */ ('=='),
    }
  }

  /**
   * @param {object} terms
   * @param {API.Term} terms.this
   * @param {API.Term} terms.than
   */
  static greater(terms) {
    return {
      match: terms,
      operator: /** @type {const} */ ('>'),
    }
  }
  static ['>'] = this.greater

  /**
   * @param {object} terms
   * @param {API.Term} terms.this
   * @param {API.Term} terms.than
   */
  static greaterOrEqual(terms) {
    return {
      match: terms,
      operator: /** @type {const} */ ('>='),
    }
  }
  static ['>='] = this.greaterOrEqual

  /**
   * @param {object} terms
   * @param {API.Term} terms.this
   * @param {API.Term} terms.than
   */
  static less(terms) {
    return {
      match: terms,
      operator: /** @type {const} */ ('<'),
    }
  }
  static ['<'] = this.less

  /**
   * @param {object} terms
   * @param {API.Term} terms.this
   * @param {API.Term} terms.than
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
   * @param {API.Term} terms.of
   * @param {API.Term<string>} [terms.is]
   */
  static Type({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('data/type'),
    }
  }

  /**
   * @param {object} terms
   * @param {API.Term} terms.of
   * @param {API.Term} [terms.is]
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
   */
  static Sum({ of, with: by, is }) {
    return {
      match: { of, with: by, is },
      operator: /** @type {const} */ ('+'),
    }
  }
  static ['+'] = this.Sum

  /**
   * @param {object} terms
   * @param {API.Term<API.Numeric>} terms.of
   * @param {API.Term<API.Numeric>} terms.by
   * @param {API.Term<API.Numeric>} [terms.is]
   */
  static Subtraction(terms) {
    return {
      match: terms,
      operator: /** @type {const} */ ('-'),
    }
  }
  static ['-'] = this.Subtraction

  /**
   * @param {object} terms
   * @param {API.Term<API.Numeric>} terms.of
   * @param {API.Term<API.Numeric>} terms.by
   * @param {API.Term<API.Numeric>} [terms.is]
   */
  static Multiplication(terms) {
    return {
      match: terms,
      operator: /** @type {const} */ ('*'),
    }
  }
  static ['*'] = this.Multiplication

  /**
   * @param {object} terms
   * @param {API.Term<API.Numeric>} terms.of
   * @param {API.Term<API.Numeric>} terms.by
   * @param {API.Term<API.Numeric>} [terms.is]
   */
  static Division(terms) {
    return {
      match: terms,
      operator: /** @type {const} */ ('/'),
    }
  }
  static ['/'] = this.Division

  /**
   * @param {object} terms
   * @param {API.Term<API.Numeric>} terms.of
   * @param {API.Term<API.Numeric>} terms.by
   * @param {API.Term<API.Numeric>} [terms.is]
   */
  static Modulo(terms) {
    return {
      match: terms,
      operator: /** @type {const} */ ('%'),
    }
  }
  static ['%'] = this.Modulo

  /**
   * @param {object} terms
   * @param {API.Term<API.Numeric>} terms.of
   * @param {API.Term<API.Numeric>} terms.exponent
   * @param {API.Term<API.Numeric>} [terms.is]
   */
  static Power(terms) {
    return {
      match: terms,
      operator: /** @type {const} */ ('**'),
    }
  }
  static ['**'] = this.Power

  /**
   * @param {object} terms
   * @param {API.Term<API.Numeric>} terms.of
   * @param {API.Term<API.Numeric>} [terms.is]
   */
  static Absolute({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('math/absolute'),
    }
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
   * @returns {Rule<Descriptor>}
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
      this.this.descriptor,
      /** @type {[API.Conjunct, ...API.Conjunct[]]} */ (when)
    )
  }
}

/**
 * @template {API.RuleDescriptor} Descriptor
 * @extends {Callable<(terms?: Partial<API.RuleBindings<API.InferRuleVariables<Descriptor>>>) => Analyzer.RuleApplication<API.InferRuleVariables<Descriptor>>>}
 */
class Rule extends Callable {
  /**
   * @param {Descriptor} descriptor
   * @param {API.Every} where
   */
  constructor(descriptor, where) {
    super(
      /** @param {Partial<API.RuleBindings<API.InferRuleVariables<Descriptor>>>} [terms] */
      (terms) => this.match(terms)
    )

    this.rule = Analyzer.rule({
      match: RuleBuilder.buildMatch(descriptor),
      when: where,
    })
  }
  /**
   *
   * @param {Partial<API.RuleBindings<API.InferRuleVariables<Descriptor>>>} [terms]
   * @returns {Analyzer.RuleApplication<API.InferRuleVariables<Descriptor>>}
   */
  match(terms = {}) {
    return this.rule.apply({ ...this.rule.match, ...terms })
  }
}
