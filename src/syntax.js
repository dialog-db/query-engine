import * as API from './api.js'
import * as Analyzer from './analyzer.js'
import * as Task from './task.js'
import { $, _ } from './$.js'
import * as Variable from './variable.js'
import { Callable } from './syntax/callable.js'
import * as Selector from './selector.js'
import * as Link from './data/link.js'
import { toDebugString } from './analyzer.js'
import { toJSON } from './analyzer.js'

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
 * @returns {API.Premise<The, Omit<Schema, 'the'> & { this: ObjectConstructor }, {}>}
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

  return new Premise(the, schema, {})
}

export const claim = fact

/**
 * @template {string} The
 * @template {API.FactSchema} Schema
 * @template {API.RuleDescriptor} [Locals={}]
 * @implements {API.Premise<The, Schema>}
 * @extends {Callable<(terms?: API.InferFactTerms<Schema>) => FactMatch<The, Schema>>}
 */
class Premise extends Callable {
  /**
   * @param {The} the
   * @param {Schema} schema
   * @param {Locals} locals
   */
  constructor(the, schema, locals) {
    super(
      /**
       * @param {API.InferFactTerms<Schema>} [terms]
       * @returns {FactMatch<The, Schema>}
       */
      (terms = this.ports) => this.match(terms)
    )
    this.the = the
    this.schema = schema
    this.locals = locals
  }

  /** @type {API.InferRuleVariables<Schema>|undefined} */
  #ports
  /**
   * Map of variables corresponding to the fact members.
   *
   * @type {API.InferRuleVariables<Schema>}
   */
  get ports() {
    if (!this.#ports) {
      this.#ports = derivePorts(this.schema)
    }
    return this.#ports
  }

  get cells() {
    return this.ports
  }
  /**
   * Builds a deduction form for the this fact.
   *
   * @returns {API.DeductiveRule<API.InferRuleVariables<Schema>>}
   */
  build() {
    const { the, schema, ports: $ } = this
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
   * @param {API.InferRuleTerms<Schema>} terms
   * @returns {Analyzer.RuleApplication<API.InferRuleVariables<Schema>>}
   */
  apply(terms) {
    return this.form.apply(terms)
  }

  /**
   * @param {Partial<API.InferFactTerms<Schema>>} terms
   * @returns {API.MatchView}
   */
  recur(terms) {
    return [this.form.apply(/** @type {API.InferRuleTerms<Schema>} */ (terms))]
  }

  /**
   * Creates predicate for this fact that matches given terms.
   *
   * @param {Partial<API.InferFactTerms<Schema>>} [terms]
   * @returns {FactMatch<The, Schema>}
   */
  match(terms) {
    return new FactMatch(
      this.the,
      this,
      this.ports,
      /** @type {Partial<API.InferFactTerms<Schema>>} */ (terms ?? this.ports)
    )
  }

  /**
   * Creates a predicate for this fact that excludes ones that match given
   * terms.
   *
   * @param {Partial<API.InferFactTerms<Schema>>} terms
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
    return Fact.assert(this.the, this.schema, this.cells, data)
  }

  /**
   * Defines local variables so they could be used in the `.when` and `.where`
   * methods without makeing those part of the fact.
   *
   * @template {Exclude<API.RuleDescriptor, Schema & Locals>} Extension
   * @param {Extension} extension
   * @returns {Premise<The, Schema, Locals & Extension>}
   */
  with(extension) {
    return new Premise(this.the, this.schema, { ...extension, ...this.locals })
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
   * @returns {Deduction<The, Schema, Locals>}
   */
  when(build) {
    return new Deduction(this.the, this.schema, this.locals, build)
  }

  /**
   * Defines a rule that dudces this fact whenever all of the predicates are
   * true. This is a shortuct of `.when` which is convinient in cases where
   * only one branch is needed.
   *
   * @param {API.EveryBuilder<Schema & Locals>} build
   * @returns {Deduction<The, Schema, Locals>}
   */
  where(build) {
    return new Deduction(this.the, this.schema, this.locals, build)
  }
}

/**
 *
 * @template {API.FactSchema} Schema
 * @typedef {object} Circuit
 * @property {Schema} schema
 * @property {API.InferRuleVariables<Schema>} cells
 * @property {(terms: API.InferRuleTerms<Schema>) => Analyzer.RuleApplication<API.InferRuleVariables<Schema>>} apply
 * @property {(terms: Partial<API.InferFactTerms<Schema>>) => API.MatchView} recur
 */

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
 * @template {API.FactSchema} Schema
 * @template {API.RuleDescriptor} Locals
 * @implements {API.Deduction<The, Schema, Locals>}
 * @extends {Callable<(terms?: API.InferFactTerms<Schema>) => FactMatch<The, Schema>>}
 */
class Deduction extends Callable {
  /**
   * @param {The} the
   * @param {Schema} schema
   * @param {Locals} locals
   * @param {API.WhenBuilder<Schema & Locals>} build
   */
  constructor(the, schema, locals, build) {
    super((terms) => this.match(terms))

    this.the = the
    this.schema = schema
    this.locals = locals
    this.build = build
  }

  /**
   * If rule is applied recursively we want to return `Recur` as opposed to
   * plain `FactMatch` to accomplish this we set this property to `this`
   * during `source` compilation. This works because when/where `build` function
   * is called during compilation which in turn ends up calling `match` method
   * that looks at `this.#circuit` to decide which one to construct. Furthermore
   * we do pass this `#circuit` to it during construction.
   *
   * @type {Circuit<Schema>|null}
   */
  self = null

  /** @type {API.InferRuleVariables<Schema>|undefined} */
  #ports

  /**
   * Map of variables corresponding to the fact members.
   *
   * @type {API.InferRuleVariables<Schema>}
   */
  get ports() {
    const $ = this.#ports
    if ($ == null) {
      const $ = derivePorts(this.schema)
      this.#ports = $
      return $
    } else {
      return $
    }
  }

  /** @type {undefined|(API.InferRuleVariables<Schema & Locals> & {_: API.Variable, this: API.Variable<API.Entity>})} */
  #cells
  get cells() {
    if (!this.#cells) {
      const cells =
        /** @type {API.InferRuleVariables<Schema & Locals> & {_: API.Variable, this: API.Variable<API.Entity>}} */
        (
          deriveCells({
            ...this.locals,
            ...this.schema,
          })
        )
      this.#cells = cells
    }
    return this.#cells
  }

  compile() {
    const when = /** @type {Record<string, API.Every>} */ ({})
    for (const [name, disjunct] of iterateDisjuncts(this.build(this.cells))) {
      when[name] = /** @type {[API.Conjunct, ...API.Conjunct[]]} */ ([
        ...iterateConjuncts(disjunct),
      ])
    }

    return {
      match: this.ports,
      when: /** @type {API.Some} */ (when),
    }
  }

  /** @type {API.DeductiveRule<API.InferRuleVariables<Schema>>|undefined} */
  #source
  get source() {
    if (!this.#source) {
      this.self = this
      this.#source = this.compile()
      this.self = null
    }
    return this.#source
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
   * @param {API.InferRuleTerms<Schema>} terms
   * @returns {Analyzer.RuleApplication<API.InferRuleVariables<Schema>>}
   */
  apply(terms) {
    return this.form.apply(terms)
  }

  /**
   * @param {Partial<API.InferFactTerms<Schema>>} terms
   * @returns {API.MatchView}
   */
  recur(terms) {
    return [
      /** @type {API.Recur} */ ({ recur: { this: this.ports.this, ...terms } }),
    ]
  }

  /**
   * @param {Partial<API.InferFactTerms<Schema>>} terms
   */
  induce(terms) {
    const { schema, cells, the } = this
    const predicates = []
    for (const [name, member] of Object.entries(schema)) {
      const [term, cell] = [terms[name], cells[name]]
      // If `this` was not provided we derive one from the data itself.
      if (name === 'this' && !term) {
        predicates.push(
          Fact.claim({
            .../** @type {Record<string, API.Term>} */ (terms),
            this: cells.this,
            the,
          })
        )
      } else {
        predicates.push(
          ...same({ this: /** @type {API.Scalar} */ (term), as: cell })
        )
      }
    }

    return new Claim(predicates)
  }

  /**
   * @param {Partial<API.InferFactTerms<Schema>>} [terms]
   * @returns {FactMatch<The, Schema>}
   */
  match(terms = /** @type {API.InferFactTerms<Schema>}} */ (this.ports)) {
    return this.self ?
        new Recur(this.the, this.self, this.ports, terms)
      : new FactMatch(this.the, this, this.ports, terms)
  }

  /**
   * Creates a predicate for this fact that excludes ones that match given
   * terms.
   *
   * @param {Partial<API.InferFactTerms<Schema>>} terms
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
    return Fact.assert(this.the, this.schema, this.cells, data)
  }

  /**
   * @param {API.InferFactTerms<Schema>} fact
   */
  claim(fact) {
    return this.induce(fact)
  }

  /**
   * This method can be used to project different layout of the selected facts,
   * it is maraked deprecated, but it is not deprecated but rather an
   * experimental and may be removed at any point. This method can be used as an
   * aggregator to group results, however this leads to nested structures which
   * are at odds with the facts that are flat records.
   *
   * @deprecated
   *
   * @template {API.Selector} Selector
   * @param {API.ProjectionBuilder<Schema & Locals, Selector>} build
   * @returns {Select<The, Schema, Locals, Selector>}
   */
  select(build = (variables) => /** @type {Selector} */ (variables)) {
    return new Select(build, this)
  }

  /**
   * Defines local variables so they could be used in the `.when` and `.where`
   * methods without makeing those part of the fact.
   *
   * @template {Omit<API.RuleDescriptor, keyof Schema | keyof Locals>} Extension
   * @param {Extension} extension
   * @returns {API.Premise<The, Schema, Locals & Extension>}
   */
  with(extension) {
    return new Premise(this.the, this.schema, { ...extension, ...this.locals })
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
   * @returns {Deduction<The, Schema, Locals>}
   */
  when(build) {
    return new Deduction(this.the, this.schema, this.locals, build)
  }

  /**
   * Defines a rule that dudces this fact whenever all of the predicates are
   * true. This is a shortuct of `.when` which is convinient in cases where
   * only one branch is needed.
   *
   * @param {API.EveryBuilder<Schema & Locals>} build
   * @returns {Deduction<The, Schema, Locals>}
   */
  where(build) {
    return new Deduction(this.the, this.schema, this.locals, build)
  }

  /** @type {Induction<The, Schema, Locals>|undefined} */
  #induction
  get inductive() {
    if (!this.#induction) {
      const { self, the, schema, locals, build } = this
      const induction = new Induction(the, schema, locals, build)
      this.self = induction
      // Force induction compilaction so that it will be the self in the given
      // context.
      induction.form
      // Then we reset the self so that it continues to behave as intended.
      this.self = self
      // cache the instance
      this.#induction = induction
    }

    return this.#induction
  }
}

/**
 * @template {string} The
 * @template {API.RuleDescriptor & {this: ObjectConstructor}} Schema
 * @template {API.RuleDescriptor} Locals
 * @extends {Deduction<The, Schema, Locals>}
 */
class Induction extends Deduction {
  /**
   * @param {Partial<API.InferFactTerms<Schema>>} terms
   * @returns {API.MatchView}
   */
  recur(terms) {
    return this.induce(terms)
  }
}

/**
 * @template {API.RuleDescriptor} Schema
 */
class Match {
  /**
   * @param {Analyzer.DeductiveRule<API.InferRuleVariables<Schema>>} rule
   * @param {API.InferRuleTerms<Schema>} terms
   */
  constructor(rule, terms) {
    this.rule = rule
    this.terms = terms
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
}

/**
 * @template {string} The
 * @template {API.RuleDescriptor & {this: ObjectConstructor}} Schema
 * @implements {API.MatchView<unknown>}
 */
class FactMatch {
  /**
   * @param {The} the
   * @param {Circuit<Schema>} rule
   * @param {API.InferRuleVariables<Schema>} ports
   * @param {Partial<API.InferFactTerms<Schema>>} terms
   */
  constructor(the, rule, ports, terms) {
    this.the = the
    this.rule = rule
    this.ports = ports
    this.terms = terms
    const selector = /** @type {Record<string, API.Term>} */ ({})
    for (const key of Object.keys(ports)) {
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
      this.#form = this.rule.apply(
        /** @type {API.InferRuleTerms<Schema>} */
        (this.terms)
      )
    }
    return this.#form
  }

  /** @returns {Iterator<API.Conjunct|API.Recur>} */
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
        this.terms === /** @type {object} */ (this.ports) ?
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
        Fact.new(
          /** @type {API.InferFact<Schema> & {this: API.Entity, the: The }}} */ (
            model
          ),
          this.rule.schema,
          this.rule.cells
        )
      )
    }

    return facts
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
 * Subclass of {@link FactMatch} that represents a recursive rule application.

 * @template {string} The
 * @template {API.RuleDescriptor & {this: ObjectConstructor}} Schema
 * @extends {FactMatch<The, Schema>}
 */
class Recur extends FactMatch {
  /**
   * We override the itertor to yield recursion form as opposed to application
   * from.
   */
  *[Symbol.iterator]() {
    yield* this.rule.recur(this.terms)
  }
}

/**
 * @template {string} The
 * @template {{ this: API.Entity, the: The }} Model
 * @template {API.RuleDescriptor & { this: ObjectConstructor }} Schema
 */
class Fact {
  /**
   * @template {string} The
   * @param {Record<string, API.Term> & {this: API.Term<API.Entity>, the: The}} terms
   */
  static claim(terms) {
    /**
     * ⚠️ This needs to be aligned with {@link Fact.assert} implementation
     * so that `this` will come out same in both cases.
     */
    return Data.Fact(terms)
  }

  /**
   * @template {string} The
   * @template {API.RuleDescriptor & { this: ObjectConstructor }} Schema
   * @param {The} the
   * @param {Schema} schema
   * @param {API.InferRuleVariables<Schema>} cells
   * @param {API.InferRuleTerms<Omit<Schema, 'this'>> & {this?: API.Entity}} data
   */
  static assert(the, schema, cells, data) {
    /**
     * ⚠️ This needs to be aligned with {@link Fact.claim} implementation
     * that `this` will come out same in both cases.
     * @type {Record<string, API.Scalar>}
     */
    const model = { the, this: data.this ?? Link.of({ ...data, the }) }

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

    return Fact.new(
      /** @type {API.InferFact<Schema> & {the: The}} */ (model),
      schema,
      cells
    )
  }

  /**
   * @template {string} The
   * @template {API.RuleDescriptor & { this: ObjectConstructor }} Schema
   * @template {{ this: API.Entity, the: The }} Model
   * @param {Model} model
   * @param {Schema} schema
   * @param {API.InferRuleVariables<Schema>} cells
   * @returns {Fact<The, Model, Schema> & Model}
   */
  static new(model, schema, cells) {
    return /** @type {Fact<The, Model, Schema> & Model} */ (
      new this(model, schema, cells)
    )
  }

  /**
   * @param {Model} model
   * @param {Schema} schema
   * @param {API.InferRuleVariables<Schema>} cells
   */
  constructor(model, schema, cells) {
    this.#model = model
    this.#schema = schema
    this.#cells = cells
    const { the, ...data } = model

    Object.assign(this, data)
    this.this = model.this
  }
  #model
  #schema
  #cells

  get the() {
    return this.#model.the
  }

  /**
   * @returns {IterableIterator<API.SystemOperator & {Assert: API.Fact}>}
   */
  *[Symbol.iterator]() {
    const { the, this: entity } = this
    yield {
      match: { of: entity, is: this.#cells.this },
      operator: '==',
      Assert: [entity, 'the', the],
    }

    for (const [name, value] of Object.entries(this.#model)) {
      if (name !== 'this' && name !== 'the') {
        yield /** @type {(API.SystemOperator & {Assert: API.Fact})} */ ({
          Assert: [entity, `${the}/${name}`, value],
          match: { of: value, is: this.#cells[name] },
          operator: '==',
        })
      }
    }
  }

  toJSON() {
    return { ...this, the: this.the, this: toJSON(this.this) }
  }
}

/**
 * @implements {API.MatchView<unknown>}
 */
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
 * @template {string} The
 * @template {API.FactSchema} Schema
 * @template {API.RuleDescriptor} Locals
 * @template {API.Selector} Selector
 * @implements {API.Projection<Schema, Selector>}
 * @extends {Callable<(terms?: API.InferRuleTerms<Schema>) => GroupedSelection<The, Schema, Selector>>}
 */
class Select extends Callable {
  /**
   * @param {API.ProjectionBuilder<Schema & Locals, Selector>} build
   * @param {Deduction<The, Schema, Locals>} rule
   */
  constructor(build, rule) {
    super(
      /** @type {typeof this.match} */
      (terms) => this.match(terms)
    )
    this.rule = rule
    this.build = build
  }

  get the() {
    return this.rule.the
  }

  /** @type {Selector|undefined} */
  #selector
  get selector() {
    if (!this.#selector) {
      this.#selector = this.build(this.cells)
    }
    return this.#selector
  }

  get ports() {
    return this.rule.ports
  }

  get cells() {
    return this.rule.cells
  }

  get form() {
    return this.rule.form
  }

  /**
   * @param {Partial<API.InferRuleTerms<Schema>>} [terms]
   * @returns {GroupedSelection<The, Schema, Selector>}
   */
  match(terms) {
    return new GroupedSelection(
      this.the,
      this.form,
      this.ports,
      terms ?? this.ports,
      this.selector
    )
  }
}

/**
 * @template {string} The
 * @template {API.RuleDescriptor & {this: ObjectConstructor}} Schema
 * @template {API.Selector} Selector
 */
class GroupedSelection {
  /**
   * @param {The} the
   * @param {Analyzer.DeductiveRule<API.InferRuleVariables<Schema>>} rule
   * @param {API.InferRuleVariables<Schema>} ports
   * @param {Partial<API.InferRuleTerms<Schema>>} terms
   * @param {Selector} selector
   */
  constructor(the, rule, ports, terms, selector) {
    this.the = the
    this.rule = rule
    this.ports = ports
    this.terms = terms
    this.selector = selector

    const variables = /** @type {Record<string, API.Term>} */ ({})
    for (const key of Object.keys(ports)) {
      if (terms[key] === undefined) {
        variables[key] = $[Symbol()]
      } else {
        variables[key] = terms[key]
      }
    }

    this.variables = /** @type {API.InferRuleTerms<Schema>} */ (variables)
  }

  /** @type {Analyzer.RuleApplication<API.InferRuleVariables<Schema>>|undefined} */
  #form
  get form() {
    if (!this.#form) {
      this.#form = this.rule.apply(
        /** @type {API.InferRuleTerms<Schema>} */ (this.terms)
      )
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
        this.terms === /** @type {object} */ (this.ports) ?
          this.form.prepare()
        : this.rule.apply(this.variables).prepare()
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
    return Selector.select(this.selector, selection)
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

export { $, _ }
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

export const Collection = Operator.for(
  /**
   * @template {API.Scalar} Member
   * @param {object} terms
   * @param {API.Term<API.Entity>} terms.this
   * @param {API.Term<Member>} terms.of
   * @param {API.Term<string>} [terms.at]
   */
  (terms) => ({
    match: { the: terms.at, of: terms.this, is: terms.of },
    fact: {},
  })
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
     * @returns {{match: { of: API.Term, is?: API.Term<API.Entity> }, operator: 'data/refer' }}
     */
    ({ of, is }) => {
      return {
        match: { of, is },
        operator: /** @type {const} */ ('data/refer'),
      }
    }
  )

  static Fact = Operator.for(
    /**
     * @template {Record<string, API.Term> & {this?: API.Term<API.Entity>}} Terms
     * @param {Terms} terms
     * @returns {{match: Omit<Terms, 'this'> & { is?: API.Term<API.Entity> }, operator: 'data/refer' }}
     */
    ({ this: is, ...of }) => {
      return {
        match: { ...of, is },
        operator: 'data/refer',
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

const Same = Analyzer.rule({ match: { this: $.this, as: $.this } })
const NotSame = Analyzer.rule({
  match: { this: $.this, as: $.as },
  when: {
    where: [{ not: Same.apply({ this: $.this, as: $.as }) }],
  },
})

export const same = Object.assign(
  /**
   * @template {API.Scalar} This
   * @template {API.Scalar} As
   * @param {{this: API.Term<This>, as: API.Term<As>}} terms
   */
  (terms) => new Match(Same, terms),
  {
    /**
     * @template {API.Scalar} This
     * @template {API.Scalar} As
     * @param {{this: API.Term<This>, as: API.Term<As>}} terms
     */
    not(terms) {
      return new Match(NotSame, terms)
    },
  }
)

/**
 * @template {API.RuleDescriptor} Schema
 * @param {Schema} schema
 * @returns {API.InferRuleVariables<Schema>}
 */
function derivePorts(schema) {
  const match = /** @type {Record<string, API.Variable>} */ ({})
  for (const [key, type] of Object.entries(schema)) {
    match[key] = $[key]
  }

  return /** @type {API.InferRuleVariables<Schema>} */ (match)
}

/**
 * @template {API.RuleDescriptor} Schema
 * @param {Schema} schema
 * @returns {API.InferRuleVariables<Schema> & {_: API.Variable}}
 */
function deriveCells(schema) {
  return Object.assign(derivePorts(schema), { _: $._ })
}

/**
 * @param {API.EveryView} source
 * @returns {Iterable<API.Conjunct|API.Recur>}
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
