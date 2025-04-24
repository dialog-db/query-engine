import * as API from './api.js'
import * as Analyzer from './analyzer.js'
import * as Task from './task.js'
import { $, _ } from './$.js'
import * as Variable from './variable.js'
import { Callable } from './syntax/callable.js'
import * as Selector from './selector.js'
import * as Link from './data/link.js'
import { toDebugString } from './analyzer.js'

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
 * @template {string} The
 * @template {API.RuleDescriptor & {the?: The}} Schema
 * @param {Schema} source
 * @returns {Fact<The, Omit<Schema, 'the'> & { this: ObjectConstructor }, {}>}
 */
export const fact = ({ the, ...source }) => {
  const members = []
  for (const [name, member] of Object.entries({ this: Object, ...source })) {
    const descriptor =
      fromConstructor(member) ??
      fromDescriptor(/** @type {{}|null|undefined} */ (member)) ??
      fromScalar(member)

    if (descriptor === undefined) {
      throw new TypeError(
        `Unsupported schema member ${toDebugString(/** @type {{}} */ (member))}`
      )
    } else {
      members.push([name, descriptor])
    }
  }

  const schema = Object.fromEntries(members)
  the =
    typeof the === 'string' ? the : (
      /** @type {The} */ (Link.of(schema).toString())
    )

  return new Fact(the, schema, {})
}

/**
 * @template {string} The
 * @template {API.RuleDescriptor & { this: ObjectConstructor }} Schema
 * @template {API.RuleDescriptor} [Locals={}]
 * @extends {Callable<(terms?: API.InferRuleTerms<Schema>) => FactSelector<The, Schema>>}
 */
class Fact extends Callable {
  /**
   * @param {The} the
   * @param {Schema} schema
   * @param {Locals} locals
   */
  constructor(the, schema, locals) {
    super(
      /**
       * @param {API.InferRuleTerms<Schema>} [terms]
       * @returns {FactSelector<The, Schema, Schema>}
       */
      (terms = this.$) => new FactSelector(this.the, this.form, this.$, terms)
    )
    this.the = the
    this.schema = schema
    this.locals = locals
  }

  /** @type {API.InferRuleVariables<Schema>|undefined} */
  #$
  /**
   * Map of variables corresponding to the fact members.
   *
   * @type {API.InferRuleVariables<Schema>}
   */
  get $() {
    const $ = this.#$
    if ($ == null) {
      const $ = Deduce.buildMatch(this.schema)
      this.#$ = $
      return $
    } else {
      return $
    }
  }

  /**
   * Builds a deduction form for the this fact.
   *
   * @returns {API.Deduction<API.InferRuleVariables<Schema>>}
   */
  build() {
    const { the, schema, $ } = this
    const where = []
    for (const name of Object.keys(schema)) {
      if (name !== 'this') {
        where.push({
          match: {
            the: `${the}/${name}`,
            of: $.this,
            is: $[name],
          },
          fact: {},
        })
      }
    }

    return { match: $, when: { where } }
  }

  /** @type {Analyzer.DeductiveRule<API.InferRuleVariables<Schema>>|undefined} */
  #form

  /**
   * Deductive rule correpsonding to this fact.
   */
  get form() {
    const form = this.#form
    if (form) {
      return form
    } else {
      const form = Analyzer.rule(this.build())
      this.#form = form
      return form
    }
  }

  /**
   * Creates predicate for this fact that matches given terms.
   *
   * @template {Partial<Schema>} Selector
   * @param {API.InferRuleTerms<Selector>} [terms]
   * @returns {FactSelector<The, Schema, Selector>}
   */
  match(terms) {
    return new FactSelector(
      this.the,
      this.form,
      this.$,
      /** @type {API.InferRuleTerms<Selector>} */ (terms ?? this.$)
    )
  }

  /**
   * Creates a predicate for this fact that excludes ones that match given
   * terms.
   *
   * @template {Partial<Schema>} Terms
   * @param {API.InferRuleTerms<Terms>} terms
   * @returns {Negation<Schema>}
   */
  not(terms) {
    return new Negation(this.match(terms).form)
  }

  /**
   * Asserts this fact with a given data. If data does not conforms this fact
   * throws an error.
   *
   * @param {API.InferRuleTerms<Omit<Schema, 'this'>> & {this?: API.Entity}} data
   */
  assert(data) {
    return FactView.assert(this.the, this.schema, data)
  }

  /**
   * Defines local variables so they could be used in the `.when` and `.where`
   * methods without makeing those part of the fact.
   *
   * @template {Omit<API.RuleDescriptor, keyof Schema | keyof Locals>} Extension
   * @param {Extension} extension
   * @returns {Fact<The, Schema, Locals & Extension>}
   */
  with(extension) {
    return new Fact(this.the, this.schema, { ...extension, ...this.locals })
  }

  /**
   * Defines a rule that deduces this fact whenever any of the branches are true.
   * Takes a `build` function that will be given set of variables corresponding
   * to the fact members which must return object where keys represent disjuncts
   * and values are arrays representing conjuncts for those disjuncts. In other
   * works each member of the returned object represent OR branches where each
   * branch is an AND joined predicates by passed variables.
   *
   * @param {API.SomeBuilder<Schema & Locals>} build
   * @returns {FactDeduction<The, Schema, Locals>}
   */
  when(build) {
    return new FactDeduction(this.the, this.schema, this.locals, build)
  }

  /**
   * Defines a rule that dudces this fact whenever all of the predicates are
   * true. This is a shortuct of `.when` which is convinient in cases where
   * only one branch is needed.
   *
   * @param {API.EveryBuilder<Schema & Locals>} build
   * @returns {FactDeduction<The, Schema, Locals>}
   */
  where(build) {
    return new FactDeduction(this.the, this.schema, this.locals, build)
  }
}

/**
 * @template {string} The
 * @template {API.RuleDescriptor & {this: ObjectConstructor}} Schema
 * @template {Partial<Schema>} [Terms=Schema]
 */
class FactSelector {
  /**
   * @param {The} the
   * @param {Analyzer.DeductiveRule<API.InferRuleVariables<Schema>>} rule
   * @param {API.InferRuleVariables<Schema>} variables
   * @param {API.InferRuleTerms<Terms>} terms
   */
  constructor(the, rule, variables, terms) {
    this.the = the
    this.rule = rule
    this.variables = variables
    this.terms = terms
    const selector = /** @type {Record<string, API.Term>} */ ({})
    for (const key of Object.keys(variables)) {
      if (terms[key] === undefined) {
        selector[key] = $[Symbol()]
      } else {
        selector[key] = terms[key]
      }
    }

    this.selector = /** @type {API.InferRuleTerms<Schema>} */ (selector)
  }

  /** @type {Analyzer.RuleApplication<API.InferRuleVariables<Schema>>|undefined} */
  #form
  get form() {
    if (!this.#form) {
      this.#form = this.rule.apply(this.terms)
    }
    return this.#form
  }

  *[Symbol.iterator]() {
    yield this.form
  }

  /** @type {Analyzer.RuleApplicationPlan<API.InferRuleVariables<Schema>>|undefined} */
  #plan
  get plan() {
    if (!this.#plan) {
      this.#plan =
        // If selector and terms match we can reuse the form, but if they do not
        // we need to create new form which will include all the terms.
        this.terms === /** @type {object} */ (this.variables) ?
          this.form.prepare()
        : this.rule.apply(this.selector).prepare()
    }

    return this.#plan
  }

  toJSON() {
    return this.form.toJSON()
  }
  /**
   * @param {{ from: API.Querier }} source
   */
  *execute(source) {
    const { selector, plan } = this
    const selection = yield* plan.query(source)

    console.log()

    const facts = []
    for (const match of selection) {
      /** @type {Record<string, API.Scalar>} */
      const model = {}
      for (const [key, term] of Object.entries(selector)) {
        model[key] = /** @type {API.Scalar} */ (
          Variable.is(term) ? match.get(term) : term
        )
      }
      model.the = this.the
      facts.push(
        FactView.new(
          /** @type {API.InferFact<Schema> & {this: API.Entity, the: The }}} */ (
            model
          )
        )
      )
    }

    return /** @type {API.InferFact<Schema>[]} */ (facts)
  }

  /**
   * @param {{ from: API.Querier }} source
   */
  query(source) {
    // 😵‍💫 Here we force plan compilation because we want to get planning error
    // before we get a
    this.plan
    return Task.perform(this.execute(source))
  }
}

/**
 * @template {string} The
 * @template {{ this: API.Entity, the: The }} Model
 */
class FactView {
  /**
   * @template {string} The
   * @template {API.RuleDescriptor & { this: ObjectConstructor }} Schema
   * @param {The} the
   * @param {Schema} schema
   * @param {API.InferRuleTerms<Omit<Schema, 'this'>> & {this?: API.Entity}} data
   */
  static assert(the, schema, data) {
    /** @type {Record<string, API.Scalar>} */
    const model = { the, this: data.this ?? Link.of({ of: data }) }

    for (const key of Object.keys(schema)) {
      const value = data[key]
      if (key === 'the' && the !== /** @type {API.Scalar} */ (value)) {
        throw new TypeError(
          `Optional property "the" does not match the schema "${the}"`
        )
      }

      if (key !== 'this') {
        if (value === undefined) {
          throw new TypeError(`Required property "${key}" is missing`)
        }

        model[key] = /** @type {API.Scalar} */ (value)
      }
    }

    return FactView.new(
      /** @type {API.InferFact<Schema> & {the: The}} */ (model)
    )
  }

  /**
   * @template {string} The
   * @template {{ this: API.Entity, the: The }} Model
   * @param {Model} model
   * @returns {FactView<The, Model> & Model}
   */
  static new(model) {
    return /** @type {FactView<The, Model> & Model} */ (new this(model))
  }

  /**
   * @param {Model} model
   */
  constructor(model) {
    this.#model = model
    const { the, this: _, ...data } = model
    Object.assign(this, data)
  }
  #model
  get the() {
    return this.#model.the
  }
  get this() {
    return this.#model.this
  }
  *[Symbol.iterator]() {
    const assertions = /** @type {API.Instruction[]} */ ([])
    const { the, this: entity } = this
    for (const [name, value] of Object.entries(this.#model)) {
      assertions.push({ Assert: [entity, `${the}/${name}`, value] })
    }

    yield* assertions
  }
}

/**
 * @template {API.RuleDescriptor} Schema
 */
class Negation {
  /**
   * @param {Analyzer.RuleApplication<API.InferRuleVariables<Schema>>} predicate
   */
  constructor(predicate) {
    this.predicate = predicate
  }
  toJSON() {
    return { not: this.predicate.toJSON() }
  }

  /** @type {Analyzer.Negation|undefined} */
  #form
  get form() {
    if (!this.#form) {
      this.#form = Analyzer.Negation.new(this.predicate)
    }
    return this.#form
  }

  *[Symbol.iterator]() {
    yield this.form
  }
}

/**
 * @template {string} The
 * @template {API.RuleDescriptor & {this: ObjectConstructor}} Schema
 * @template {API.RuleDescriptor} Locals
 * @extends {Callable<(terms?: API.InferRuleTerms<Schema>) => FactSelector<The, Schema>>}
 */
class FactDeduction extends Callable {
  #compiling = false

  /**
   * @param {The} the
   * @param {Schema} schema
   * @param {Locals} locals
   * @param {API.WhenBuilder<Schema & Locals>} build
   */
  constructor(the, schema, locals, build) {
    super(
      /**
       * @param {API.InferRuleTerms<Schema>} [terms]
       * @returns {FactSelector<The, Schema, Schema>}
       */
      (terms = this.$) => new FactSelector(this.the, this.form, this.$, terms)
    )

    this.the = the
    this.schema = schema
    this.locals = locals
    this.build = build
  }

  /** @type {API.InferRuleVariables<Schema>|undefined} */
  #$
  /**
   * Map of variables corresponding to the fact members.
   *
   * @type {API.InferRuleVariables<Schema>}
   */
  get $() {
    const $ = this.#$
    if ($ == null) {
      const $ = Deduce.buildMatch(this.schema)
      this.#$ = $
      return $
    } else {
      return $
    }
  }

  compile() {
    const variables = Deduce.buildVariables({ ...this.locals, ...this.schema })

    const when = /** @type {Record<string, API.Every>} */ ({})
    for (const [name, disjunct] of iterateDisjuncts(this.build(variables))) {
      when[name] = /** @type {[API.Conjunct, ...API.Conjunct[]]} */ ([
        ...iterateConjuncts(disjunct),
      ])
    }

    return {
      match: this.$,
      when: /** @type {API.Some} */ (when),
    }
  }

  /** @type {API.Deduction<API.InferRuleVariables<Schema>>|undefined} */
  #source
  get source() {
    const source = this.#source
    if (source) {
      return source
    } else {
      this.#compiling = true
      const source = this.compile()
      this.#compiling = false
      this.#source = source
      return source
    }
  }

  /** @type {Analyzer.DeductiveRule<API.InferRuleVariables<Schema>>|undefined} */
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
   * @param {API.InferRuleVariables<Schema>} match
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
   * @template {Partial<Schema>} Selector
   * @param {API.InferRuleTerms<Selector>} [terms]
   * @returns {FactSelector<The, Schema, Selector>}
   */
  match(terms) {
    return new FactSelector(
      this.the,
      this.form,
      this.$,
      /** @type {API.InferRuleTerms<Selector>} */ (terms ?? this.$)
    )
  }

  /**
   * Creates a predicate for this fact that excludes ones that match given
   * terms.
   *
   * @template {Partial<Schema>} Terms
   * @param {API.InferRuleTerms<Terms>} terms
   * @returns {Negation<Schema>}
   */
  not(terms) {
    return new Negation(this.match(terms).form)
  }

  /**
   * Asserts this fact with a given data. If data does not conforms this fact
   * throws an error.
   *
   * @param {API.InferRuleTerms<Omit<Schema, 'this'>> & {this?: API.Entity}} data
   */
  assert(data) {
    return FactView.assert(this.the, this.schema, data)
  }

  /**
   * @param {API.InferRuleTerms<Schema & { this?: ObjectConstructor }>} fact
   */
  claim(fact) {
    const predicates = []
    const variables = this.$
    for (const [name, member] of Object.entries(this.schema)) {
      predicates.push(
        ...same({
          this: /** @type {API.Scalar} */ (fact[name]),
          as: variables[name],
        })
      )
    }

    return new Claim(predicates)
  }

  // /**
  //  * @template {API.Selector} Selector
  //  * @param {API.ProjectionBuilder<Schema & Locals, Selector>} build
  //  * @returns {Select<Schema, Locals, Selector>}
  //  */
  // select(build = (variables) => /** @type {Selector} */ (variables)) {
  //   return new Select(build, this)
  // }
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

/**
 * @template {API.Scalar} This
 * @template {API.Scalar} As
 * @param {{this: API.Term<This>, as: API.Term<As>}} terms
 */
export const same = (terms) => new Match(terms, Same)

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
  #compiling = false

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

  /** @type {API.Deduction<API.InferRuleVariables<Descriptor>>|undefined} */
  #source
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
  select(build = (variables) => /** @type {Selector} */ (variables)) {
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

  /**
   * @param {API.InferRuleTerms<Descriptor & { this?: ObjectConstructor }>} fact
   */
  claim(fact) {
    const predicates = []
    const variables = Deduce.buildMatch(this.descriptor)
    for (const [name, member] of Object.entries(this.descriptor)) {
      const value = fact[name]
      const variable = variables[name]
      predicates.push(
        ...same({ this: /** @type {API.Scalar} */ (value), as: variable })
      )
    }

    return new Claim(predicates)
  }
}

class Claim {
  /**
   * @param {API.Conjunct[]} predicates
   */
  constructor(predicates) {
    this.predicates = predicates
  }
  *[Symbol.iterator]() {
    yield* this.predicates
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
   * @param {Deduction<Descriptor, Locals>} rule
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
  *execute(source) {
    const selection = yield* this.form.query(source)
    // const result = this.selector ? selection.select(this.selector) : selection
    // return result.values()
    return Selector.select(this.selector ?? this.match, selection)
    // return selection
  }

  /**
   * @param {{ from: API.Querier }} source
   */
  query(source) {
    return Task.perform(this.execute(source))
  }

  *[Symbol.iterator]() {
    yield this.rule.apply(this.match)
  }
}

/**
 * @template {API.Conclusion} Match
 */
class Match {
  /**
   * @param {API.RuleBindings<Match>} terms
   * @param {Analyzer.DeductiveRule<Match>} rule
   */
  constructor(terms, rule) {
    this.terms = terms
    this.rule = rule
  }

  /** @type {Analyzer.RuleApplication<Match>|undefined} */
  #form
  get form() {
    if (!this.#form) {
      this.#form = /** @type {Analyzer.RuleApplication<Match>} */ (
        this.rule.apply(this.terms)
      )
    }
    return this.#form
  }

  /** @type {Analyzer.RuleApplicationPlan<Match>|undefined} */
  #plan
  get plan() {
    if (!this.#plan) {
      this.#plan = this.form.prepare()
    }

    return this.#plan
  }

  toJSON() {
    return this.form.toJSON()
  }
  /**
   * @param {{ from: API.Querier }} source
   */
  *execute(source) {
    const selection = yield* this.plan.query(source)
    return Selector.select(this.terms, selection)
  }

  /**
   * @param {{ from: API.Querier }} source
   */
  query(source) {
    // 😵‍💫 Here we force plan compilation because we want to get planning error
    // before we get a
    this.plan
    return Task.perform(this.execute(source))
  }

  *[Symbol.iterator]() {
    yield this.form
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
