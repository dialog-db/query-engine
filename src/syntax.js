import * as API from './api.js'
import * as Analyzer from './analyzer.js'
import { $, _ } from './$.js'
import { Callable } from './syntax/callable.js'
import * as Link from './data/link.js'

/**
 * @param {unknown} descriptor
 * @returns {API.Type|undefined}
 */
const fromConstructor = (descriptor) => {
  switch (descriptor) {
    case globalThis.Boolean:
      return { Boolean: {} }
    case globalThis.String:
      return { String: {} }
    case globalThis.Symbol:
      return { Name: {} }
    case globalThis.Number:
      return { Integer: {} }
    case globalThis.BigInt:
      return { Integer: {} }
    case globalThis.Uint8Array:
      return { Bytes: {} }
    case globalThis.Object:
      return { Entity: {} }
    case null:
      return { Null: {} }
  }
}

/**
 * @param {Record<string, unknown>|null|undefined} descriptor
 * @returns {API.Type|undefined}
 */
const fromDescriptor = (descriptor) => {
  if (descriptor?.Null) {
    return { Null: {} }
  } else if (descriptor?.Boolean) {
    return { Boolean: {} }
  } else if (descriptor?.String) {
    return { String: {} }
  } else if (descriptor?.Integer) {
    return { Integer: {} }
  } else if (descriptor?.Float) {
    return { Float: {} }
  } else if (descriptor?.Bytes) {
    return { Bytes: {} }
  } else if (descriptor?.Entity) {
    return { Entity: {} }
  } else if (descriptor?.Name) {
    return { Name: {} }
  } else if (descriptor?.Position) {
    return { Position: {} }
  } else if (descriptor?.Reference) {
    return { Reference: {} }
  }
}

/**
 *
 * @param {unknown} source
 * @returns {API.Scalar|undefined}
 */
const fromScalar = (source) => {
  switch (typeof source) {
    case 'string':
    case 'number':
    case 'bigint':
    case 'boolean':
      return source
    case 'object':
      return source == null || source instanceof Uint8Array ? source : undefined
    default:
      return undefined
  }
}

/**
 * @param {unknown} source
 * @returns {{'/': string} & Record<string, API.Type>|undefined}
 */

const fromObject = (source) => {
  if (typeof source === 'object' && !Array.isArray(source) && source) {
    return schema(/** @type {API.RuleDescriptor} */ (source))
  }
}

/**
 * @template {API.RuleDescriptor} Descriptor
 * @param {Descriptor} source
 */
export const schema = (source) => {
  const properties = []
  const references = []
  for (const [name, member] of Object.entries(source)) {
    const descriptor =
      fromConstructor(member) ??
      fromDescriptor(/** @type {{}|null|undefined} */ (member)) ??
      fromScalar(member)

    if (name === 'this') {
      throw new RangeError(`Can not use "this" field name`)
    }

    if (descriptor !== undefined) {
      properties.push([name, descriptor])
    } else {
      const nested = fromObject(member)
      if (nested) {
        properties.push([name, nested])
        references.push([name, Link.fromJSON({ ['/']: nested['#'] })])
      }
    }
  }

  const descriptor = Object.fromEntries(properties)
  const id = Link.of({
    ...descriptor,
    ...Object.fromEntries(references),
  }).toString()

  const members = []
  for (const [name, descriptor] of properties) {
    members.push([name, { the: `${id}/${name}`, is: descriptor }])
  }
  members.push(['this', { the: `${id}/this`, is: descriptor }])

  return Object.assign(class extends Schema {}, {
    ['#']: id,
    ...Object.fromEntries(members),
  })
}

class Schema extends Callable {}

/**
 * @template {API.RuleDescriptor} Descriptor
 * @param {Descriptor} descriptor
 */
export const fact = (descriptor) => new Fact({ ...descriptor, this: Object })

/**
 * @template {API.RuleDescriptor} Descriptor
 @extends {Callable<(terms?: API.InferRuleTerms<Descriptor>) => Application<Descriptor, {}>>}
 */
class Fact extends Callable {
  /**
   * @param {Descriptor} descriptor
   */
  constructor(descriptor) {
    super(
      /** @type {typeof this.match} */
      (terms) => this.match(terms)
    )
    this.descriptor = descriptor
  }

  /**
   * @param {API.InferRuleVariables<Descriptor>} variables
   * @returns {API.EveryView}
   */

  buildWhen({ _, this: self, ...variables }) {
    const when = []
    for (const [name, is] of Object.entries(variables)) {
      when.push({
        match: {
          the: /** @type {API.The} */ (name),
          of: /** @type {API.Variable<API.Entity>} */ (self),
          is,
        },
        fact: {},
      })
    }
    return when
  }

  /** @type {API.Deduction<API.InferRuleVariables<Descriptor>>|undefined} */
  #source

  get source() {
    const source = this.#source
    if (source) {
      return source
    } else {
      const match = Deduce.buildMatch(this.descriptor)
      const variables = Deduce.buildVariables(this.descriptor)
      const where = this.buildWhen(variables)
      const source = { match, when: /** @type {API.Some} */ ({ where }) }
      this.#source = source
      return source
    }
  }
  /** @type {Analyzer.DeductiveRule<API.InferRuleVariables<Descriptor>>|undefined} */
  #form
  get form() {
    const form = this.#form
    if (form) {
      return form
    } else {
      const form = Analyzer.rule(this.source)
      this.#form = form
      return form
    }
  }
  /**
   * @template {Partial<API.InferRuleTerms<Descriptor>>} Selection
   * @param {Selection} [terms]
   * @returns {Application<{[K in keyof Selection]: Descriptor[K]}, {}>}
   */
  match(terms) {
    const match =
      /** @type {API.InferRuleVariables<{[K in keyof Selection & keyof Descriptor]: Descriptor[K]}>} */ (
        terms ?? this.form.match
      )

    return new Application(match, this)
  }

  /**
   * @param {API.InferRuleVariables<Descriptor>} match
   * @returns {API.Conjunct}
   */
  apply(match) {
    return {
      match,
      rule: this.source,
    }
  }
}
export { $, _ }
/**
 * @template Terms
 * @template {(terms: any) => API.Constraint} F
 * @extends {Callable<F>}
 */
export class Predicate extends Callable {
  /**
   * @template Terms
   * @template {(terms: Terms) => API.Constraint} Formula
   * @param {Formula} match
   * @returns {Predicate<Terms, Formula>}
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

export const match = Predicate.for(
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

  static match = Predicate.for(
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

  static includes = Predicate.for(
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

  static Concat = Predicate.for(
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

  static Words = Predicate.for(
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

  static Lines = Predicate.for(
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

  static UpperCase = Predicate.for(
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

  static LowerCase = Predicate.for(
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

  static Trim = Predicate.for(
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

  static TrimStart = Predicate.for(
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

  static TrimEnd = Predicate.for(
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

  static Length = Predicate.for(
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
  static ToText = Predicate.for(
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

  static FromText = Predicate.for(
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

  static greater = Predicate.for(
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

  static greaterOrEqual = Predicate.for(
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

  static less = Predicate.for(
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

  static lessOrEqual = Predicate.for(
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

  static Type = Predicate.for(
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

  static Reference = Predicate.for(
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
  static Sum = Predicate.for(
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

  static Subtraction = Predicate.for(
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

  static Multiplication = Predicate.for(
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

  static Division = Predicate.for(
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

  static Modulo = Predicate.for(
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

  static Power = Predicate.for(
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

  static Absolute = Predicate.for(
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
export const deduce = (descriptor) => new Deduce(descriptor, {})

const Same = Analyzer.rule({ match: { this: $.this, as: $.this } })

export const same = Predicate.for(
  /**
   * @template {API.Scalar} This
   * @template {API.Scalar} As
   * @param {{this: API.Term<This>, as: API.Term<As>}} terms
   */
  (terms) => Same.apply(terms)
)

/**
 * @template {API.RuleDescriptor} Descriptor
 * @template {API.RuleDescriptor} Locals
 */
class Deduce {
  /**
   * @param {Descriptor} descriptor
   * @param {Locals} locals
   */
  constructor(descriptor, locals) {
    this.descriptor = descriptor
    this.locals = locals
  }

  /**
   * @returns {Deduce<Descriptor, Locals>}
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
   * @template {API.RuleDescriptor} Variables
   * @param {Variables} variables
   * @returns {API.InferRuleVariables<Variables> & {_: API.Variable}}
   */
  static buildVariables(variables) {
    return Object.assign(this.buildMatch(variables), { _: $._ })
  }

  /**
   * @template {Omit<API.RuleDescriptor, keyof Descriptor | keyof Locals>} Extension
   * @param {Extension} extension
   * @returns {Deduce<Descriptor, Locals & Extension>}
   */
  with(extension) {
    return new Deduce(this.descriptor, { ...extension, ...this.locals })
  }
  /**
   * @param {API.SomeBuilder<Descriptor & Locals>} build
   * @returns {Deduction<Descriptor, Locals>}
   */
  when(build) {
    return new Deduction(this.descriptor, this.locals, build)
  }

  /**
   * @param {API.EveryBuilder<Descriptor & Locals>} build
   * @returns {Deduction<Descriptor, Locals>}
   */
  where(build) {
    return new Deduction(this.descriptor, this.locals, build)
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
    yield ['where', source]
  } else {
    yield* Object.entries(source)
  }
}

/**
 * @template {API.RuleDescriptor} Descriptor
 * @template {API.RuleDescriptor} Locals
 * @extends {Callable<(terms?: API.InferRuleTerms<Descriptor>) => Application<Descriptor, Locals>>}
 */
class Deduction extends Callable {
  /** @type {API.Deduction<API.InferRuleVariables<Descriptor>>|undefined} */
  #source

  #compiling = false

  /** @type {Analyzer.DeductiveRule<API.InferRuleVariables<Descriptor>>|undefined} */
  #form

  /**
   * @param {Descriptor} descriptor
   * @param {Locals} locals
   * @param {API.WhenBuilder<Descriptor & Locals>} buildWhen
   * @param {Deduction<Descriptor, Locals>} [baseRule]
   */
  constructor(descriptor, locals, buildWhen, baseRule) {
    super(
      /** @type {typeof this.match} */
      (terms) => this.match(terms)
    )

    this.locals = locals
    this.descriptor = descriptor
    this.buildWhen = buildWhen
    this.baseRule = baseRule
  }

  /**
   * @template {API.RuleDescriptor} Parameters
   * @template {API.RuleDescriptor} Locals
   * @param {object} source
   * @param {Parameters} source.parameters
   * @param {Locals} source.locals
   * @param {API.WhenBuilder<Parameters & Locals>} source.buildWhen
   * @param {Deduction<Parameters, Locals>} [source.baseRule]
   * @returns {API.Deduction<API.InferRuleVariables<Parameters>>}
   */
  static compile({ parameters, locals, buildWhen, baseRule }) {
    const match = Deduce.buildMatch(parameters)
    const variables = Deduce.buildVariables({ ...locals, ...parameters })

    const base = /** @type {API.Conjunct[]} */ (
      baseRule ? [...baseRule.match(variables)] : []
    )

    const when = /** @type {Record<string, API.Every>} */ ({})
    for (const [name, disjunct] of iterateDisjuncts(buildWhen(variables))) {
      when[name] = /** @type {[API.Conjunct, ...API.Conjunct[]]} */ ([
        ...base,
        ...iterateConjuncts(disjunct),
      ])
    }

    return {
      match,
      when: /** @type {API.Some} */ (when),
    }
  }

  static compileVariables() {}

  /**
   * @template {API.RuleDescriptor} T
   * @param {API.WhenBuilder<T>} build
   * @param {API.InferRuleVariables<T> & {_: API.Variable<any>}} variables
   * @param {{match: (terms: Partial<API.RuleBindings<API.InferRuleVariables<T>>>) => Iterable<API.Conjunct>}} [base]
   */
  static compileWhen(build, variables, base) {
    const conjuncts = /** @type {API.Conjunct[]} */ (
      base ? [...base.match(variables)] : []
    )

    const when = /** @type {Record<string, API.Every>} */ ({})
    for (const [name, disjunct] of iterateDisjuncts(build(variables))) {
      when[name] = /** @type {[API.Conjunct, ...API.Conjunct[]]} */ ([
        ...conjuncts,
        ...iterateConjuncts(disjunct),
      ])
    }

    return /** @type {API.Some} */ (when)
  }

  get source() {
    const source = this.#source
    if (source) {
      return source
    } else {
      this.#compiling = true
      const source = Deduction.compile({
        parameters: this.descriptor,
        locals: this.locals,
        buildWhen: this.buildWhen,
        baseRule: this.baseRule,
      })
      this.#compiling = false
      this.#source = source
      return source
    }
  }

  get form() {
    const form = this.#form
    if (form) {
      return form
    } else {
      const form = Analyzer.rule(this.source)
      this.#form = form
      return form
    }
  }

  /**
   * @param {API.InferRuleVariables<Descriptor>} match
   * @returns {API.Conjunct}
   */
  apply(match) {
    if (this.#compiling) {
      return {
        // @ts-expect-error
        recur: match,
      }
    } else {
      return {
        match,
        rule: this.source,
      }
    }
  }

  /**
   * @template {Omit<API.RuleDescriptor, keyof Descriptor | keyof Locals>} Extension
   * @param {Extension} extension
   * @returns {Deduction<Descriptor, Locals & Extension>}
   */
  with(extension) {
    return new Deduction(
      this.descriptor,
      { ...extension, ...this.locals },
      this.buildWhen
    )
  }

  get $() {
    return this.form.match
  }
  /**
   * @template {Partial<API.InferRuleTerms<Descriptor>>} Selection
   * @param {Selection} [terms]
   * @returns {Application<{[K in keyof Selection]: Descriptor[K]}, Locals>}
   */
  match(terms) {
    const match =
      /** @type {API.InferRuleVariables<{[K in keyof Selection & keyof Descriptor]: Descriptor[K]}>} */ (
        terms ?? this.form.match
      )

    return new Application(match, this)
  }

  /**
   * @template {API.Selector} Selector
   * @param {API.ProjectionBuilder<Descriptor & Locals, Selector>} build
   * @returns {Select<Descriptor, Locals, Selector>}
   */
  select(build) {
    return new Select(build, this)
  }

  /**
   * @param {API.WhenBuilder<Descriptor & Locals>} build
   * @returns {Deduction<Descriptor, Locals>}
   */
  when(build) {
    return new Deduction(this.descriptor, this.locals, build, this)
  }

  /**
   * @param {API.EveryBuilder<Descriptor & Locals>} build
   * @returns {Deduction<Descriptor, Locals>}
   */
  where(build) {
    return this.when(build)
  }
}

/**
 * @template {API.RuleDescriptor} Descriptor
 * @template {API.RuleDescriptor} Locals
 * @template {API.Selector} [Selector=API.InferRuleVariables<Descriptor>]
 * @param {API.Every} where
 */
class Application {
  /** @type {Analyzer.RuleApplication<API.InferRuleVariables<Descriptor>>|undefined} */
  #form
  /**
   * @param {API.InferRuleVariables<Descriptor>} match
   * @param {Deduction<Descriptor, Locals> | Fact<Descriptor>} rule
   * @param {Selector} [selector]
   */
  constructor(match, rule, selector) {
    this.match = match
    this.rule = rule
    this.selector = selector
  }

  get form() {
    this.match
    if (!this.#form) {
      this.#form =
        /** @type {Analyzer.RuleApplication<API.InferRuleVariables<Descriptor>>} */ (
          this.rule.form.apply(this.match)
        )
    }
    return this.#form
  }

  toJSON() {
    return this.form.toJSON()
  }
  /**
   * @param {{ from: API.Querier }} source
   */
  query(source) {
    return this.form.query(
      this.selector ? { ...source, selector: this.selector } : source
    )
  }

  *[Symbol.iterator]() {
    yield this.rule.apply(this.match)
  }
}

/**
 * @template {API.RuleDescriptor} Descriptor
 * @template {API.RuleDescriptor} Locals
 * @template {API.Selector} Selector
 * @extends {Callable<(terms?: API.InferRuleTerms<Descriptor>) => Application<Descriptor, Locals, Selector>>}
 */
class Select extends Callable {
  /**
   * @param {API.ProjectionBuilder<Descriptor & Locals, Selector>} build
   * @param {Deduction<Descriptor, Locals>} rule
   */
  constructor(build, rule) {
    super(
      /** @type {typeof this.match} */
      (terms) => this.match(terms)
    )
    this.rule = rule
    this.build = build
  }

  /**
   * @template {Partial<API.InferRuleTerms<Descriptor>>} Selection
   * @param {Selection} [terms]
   * @returns {Application<{[K in keyof Selection]: Descriptor[K]}, Locals, Selector>}
   */
  match(terms) {
    const variables = Deduce.buildVariables({
      ...this.rule.locals,
      ...this.rule.descriptor,
    })

    const match =
      /** @type {API.InferRuleVariables<{[K in keyof Selection & keyof Descriptor]: Descriptor[K]}>} */ (
        terms ?? this.rule.form.match
      )

    return new Application(match, this.rule, this.build(variables))
  }
}
