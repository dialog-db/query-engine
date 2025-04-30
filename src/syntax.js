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
 * @template {API.RuleDescriptor} Schema
 * @param {Schema & {the?: The, this?: ObjectConstructor | { Entity: {} }, _?: never}} source
 * @returns {Premise<API.FactView<The, Omit<Schema, 'the'> & { this: ObjectConstructor }>, The, Omit<Schema, 'the'> & { this: ObjectConstructor }, {}>}
 */
export const fact = ({ the, ...source }) => {
  const members = []
  for (const [name, member] of Object.entries({ this: Object, ...source })) {
    const descriptor =
      fromConstructor(member) ??
      fromDescriptor(/** @type {{}|null|undefined} */ (member)) ??
      fromScalar(member)

    if (name === '_') {
      throw new TypeError(`Schema may no have reserved "_" property`)
    }

    if (descriptor === undefined) {
      throw new TypeError(
        `Unsupported schema member ${toDebugString(/** @type {{}} */ (member))}`
      )
    } else {
      members.push([name, descriptor])
    }
  }

  if (members.length === 1 && typeof the !== 'string') {
    throw new TypeError(
      `Schema must contain at least one property. To tag entities you could use "the" discriminant`
    )
  }

  const schema = Object.fromEntries(members)
  the =
    typeof the === 'string' ? the : (
      /** @type {The} */ (Link.of(schema).toString())
    )

  if (!schema.this.Entity) {
    throw new TypeError(
      `Schema may not have "this" property that is not an entity`
    )
  }

  /** @type {API.Premise<The, Omit<Schema, 'the'> & { this: ObjectConstructor }>} */
  const premise = {
    the,
    schema,
    attributes: deriveAttributes(schema),
  }

  const conclusion = Fact.for(premise)
  const claim = new Premise(premise, conclusion, {})

  return claim
}

export const claim = fact

/**
 * @template Fact
 * @template {string} The
 * @template {API.FactSchema} Schema
 * @extends {Callable<(terms?: API.InferFactTerms<Schema>) => FactMatch<Fact, The, Schema>>}
 */
class Builder extends Callable {
  /**
   * @param {API.Premise<The, Schema>} premise
   * @param {API.Conclusion<Fact, The, Schema>} conclusion
   */
  constructor(premise, conclusion) {
    super((terms) => this.match(terms))

    this.premise = premise
    this.conclusion = conclusion
  }

  get the() {
    return this.premise.the
  }
  /**
   * Map of variables corresponding to the fact members.
   *
   * @type {API.InferSchemaAttributes<Schema>}
   */
  get attributes() {
    return this.premise.attributes
  }

  get cells() {
    return this.attributes
  }

  /** @type {Analyzer.DeductiveRule<API.InferSchemaAttributes<Schema>>|undefined} */
  #build

  /**
   * Builds a deduction form for the this fact.
   */
  build() {
    if (!this.#build) {
      const { the, schema, attributes } = this.premise
      const where = []
      for (const name of Object.keys(schema)) {
        if (name !== 'this') {
          where.push({
            match: {
              the: `${the}/${name}`,
              of: attributes.this,
              is: attributes[name],
            },
            fact: {},
          })
        }
      }

      // If we have no other fields we should still be able to use fact as a
      // tag which is why we add a predicate for that case.
      if (where.length === 0) {
        where.push({
          match: {
            the: `the/${the}`,
            of: attributes.this,
            is: the,
          },
        })
      }

      this.#build = Analyzer.rule({ match: attributes, when: { where } })
    }
    return this.#build
  }

  /**
   * @param {API.InferSchemaTerms<Schema>} terms
   * @returns {Analyzer.RuleApplication<API.InferSchemaAttributes<Schema>>}
   */
  apply(terms) {
    return this.build().apply(terms)
  }

  /**
   * @param {API.InferFactTerms<Schema>} terms
   * @returns {API.MatchView}
   */
  recur(terms) {
    return [
      this.build().apply(/** @type {API.InferSchemaTerms<Schema>} */ (terms)),
    ]
  }

  /**
   * Creates predicate for this fact that matches given terms.
   *
   * @param {Partial<API.InferFactTerms<Schema>>} [terms]
   * @returns {FactMatch<Fact, The, Schema>}
   */
  match(terms = {}) {
    return new FactMatch(
      this.premise,
      this.conclusion,
      this,
      // TODO: previously we just passed `?? this.attributes` not sure if we
      // should do this here
      completeTerms(this.premise.schema, terms)
    )
  }

  /**
   * Creates a predicate for this fact that excludes ones that match given
   * terms.
   *
   * @param {Partial<API.InferSchemaTerms<Schema>>} terms
   * @returns {Negation<Fact, The, Schema>}
   */
  not(terms) {
    return new Negation(this.premise, this.conclusion, this, terms)
  }

  /**
   * Asserts this fact with a given data. If data does not conforms this fact
   * throws an error.
   *
   * @param {API.InferAssert<Schema>} fact
   * @returns {Fact}
   */
  assert(fact) {
    return this.conclusion.assert(fact)
  }
}

/**
 * @template Fact
 * @template {string} The
 * @template {API.FactSchema} Schema
 * @template {API.RuleDescriptor} [Context={}]
 * @implements {API.Claim<Fact, The, Schema, Context>}
 * @extends {Builder<Fact, The, Schema>}
 */
class Premise extends Builder {
  /**
   * @param {API.Premise<The, Schema>} premise
   * @param {API.Conclusion<Fact, The, Schema>} conclusion
   * @param {Context} context
   */
  constructor(premise, conclusion, context) {
    super(premise, conclusion)
    this.#context = context
  }

  #context

  /**
   * Map of variables corresponding to the fact members.
   *
   * @type {API.InferSchemaAttributes<Schema>}
   */
  get attributes() {
    return this.premise.attributes
  }

  get cells() {
    return this.attributes
  }

  /**
   * Creates a predicate for this fact that excludes ones that match given
   * terms.
   *
   * @param {Partial<API.InferSchemaTerms<Schema>>} terms
   * @returns {Negation<Fact, The, Schema>}
   */
  not(terms) {
    return new Negation(this.premise, this.conclusion, this, terms)
  }

  /**
   * Defines local variables so they could be used in the `.when` and `.where`
   * methods without makeing those part of the fact.
   *
   * @template {Exclude<API.RuleDescriptor, Schema & Context>} Extension
   * @param {Extension} extension
   * @returns {Premise<Fact, The, Schema, Context & Extension>}
   */
  with(extension) {
    return new Premise(this.premise, this.conclusion, {
      ...extension,
      ...this.#context,
    })
  }

  /**
   * Defines a rule that deduces this fact whenever any of the branches are true.
   * Takes a `build` function that will be given set of variables corresponding
   * to the fact members which must return object where keys represent disjuncts
   * and values are arrays representing conjuncts for those disjuncts. In other
   * works each member of the returned object represent OR branches where each
   * branch is an AND joined predicates by passed variables.
   *
   * @param {API.SomeBuilder<Schema & Context>} build
   * @returns {Deduction<Fact, The, Schema, Context>}
   */
  when(build) {
    return new Deduction(this.premise, this.conclusion, this.#context, build)
  }

  /**
   * Defines a rule that dudces this fact whenever all of the predicates are
   * true. This is a shortuct of `.when` which is convinient in cases where
   * only one branch is needed.
   *
   * @param {API.EveryBuilder<Schema & Context>} build
   * @returns {Deduction<Fact, The, Schema, Context>}
   */
  where(build) {
    return new Deduction(this.premise, this.conclusion, this.#context, build)
  }
}

/**
 *
 * @template {API.FactSchema} Schema
 * @template Fact
 * @typedef {object} Circuit
 * @property {API.InferSchemaAttributes<Schema>} cells
 * @property {(terms: API.InferSchemaTerms<Schema>) => Analyzer.RuleApplication<API.InferSchemaAttributes<Schema>>} apply
 * @property {(terms: API.InferSchemaTerms<Schema>) => API.MatchView} recur
 * @property {(claim: API.InferAssert<Schema>) => Fact} assert
 */

/**
 * @template Fact
 * @template {string} The
 * @template {API.RuleDescriptor & {this: ObjectConstructor}} Schema
 * @implements {API.MatchView<unknown>}
 */
class Negation {
  /**
   * @param {API.Premise<The, Schema>} premise
   * @param {API.Conclusion<Fact, The, Schema>} conclusion
   * @param {Circuit<Schema, Fact>} rule
   * @param {Partial<API.InferSchemaTerms<Schema>>} terms
   */
  constructor(premise, conclusion, rule, terms) {
    this.premise = premise
    this.conclusion = conclusion
    this.rule = rule
    this.terms = terms
  }
  /** @type {Analyzer.Negation|undefined} */
  #build
  build() {
    if (!this.#build) {
      this.#build = this.rule
        .apply(
          // This not true, but apply does not actually need all terms we only
          // type it this way to make lower level API less error prone. Perhaps
          // we need to revise it to having to lie to it.
          /** @type {API.InferSchemaTerms<Schema>} */ (this.terms)
        )
        .negate()
    }
    return this.#build
  }

  toJSON() {
    return this.build().toJSON()
  }

  *[Symbol.iterator]() {
    yield this.build()
  }
}

/**
 * @template Fact
 * @template {string} The
 * @template {API.FactSchema} Schema
 * @template {API.RuleDescriptor} Context
 * @implements {API.Deduction<Fact, The, Schema, Context>}
 * @extends {Callable<(terms?: API.InferFactTerms<Schema>) => FactMatch<Fact, The, Schema>>}
 */
class Deduction extends Callable {
  /**
   * @param {API.Premise<The, Schema>} premise
   * @param {API.Conclusion<Fact, The, Schema>} conclusion
   * @param {Context} context
   * @param {API.WhenBuilder<Schema & Context>} compile
   */
  constructor(premise, conclusion, context, compile) {
    super((terms) => this.match(terms))

    this.premise = premise
    this.conclusion = conclusion
    this.context = context
    this.compile = compile
    this.#cells =
      /** @type {API.InferSchemaAttributes<Schema & Context> & {_: API.Variable, this: API.Variable<API.Entity>}}  */
      (deriveCells({ ...this.context, ...this.premise.schema }))
  }

  /**
   * @returns {API.Deduction<Fact, The, Schema, Context>}
   */
  get me() {
    return this
  }

  get the() {
    return this.premise.the
  }
  /**
   * Map of variables corresponding to the fact members.
   *
   * @type {API.InferSchemaAttributes<Schema>}
   */
  get attributes() {
    return this.premise.attributes
  }

  /**
   * If rule is applied recursively we want to return `Recur` as opposed to
   * plain `FactMatch` to accomplish this we set this property to `this`
   * during `source` compilation. This works because when/where `build` function
   * is called during compilation which in turn ends up calling `match` method
   * that looks at `this.#circuit` to decide which one to construct. Furthermore
   * we do pass this `#circuit` to it during construction.
   *
   * @type {Circuit<Schema, Fact>|null}
   */
  self = null

  /** @type {(API.InferSchemaAttributes<Schema & Context> & {_: API.Variable, this: API.Variable<API.Entity>})} */
  #cells
  get cells() {
    return this.#cells
  }

  // compile() {
  //   const when = /** @type {Record<string, API.Every>} */ ({})
  //   for (const [name, disjunct] of iterateDisjuncts(this.build(this.cells))) {
  //     when[name] = /** @type {[API.Conjunct, ...API.Conjunct[]]} */ ([
  //       ...iterateConjuncts(disjunct),
  //     ])
  //   }

  //   return {
  //     match: this.ports,
  //     when: /** @type {API.Some} */ (when),
  //   }
  // }

  // /** @type {API.DeductiveRule<API.InferSchemaAttributes<Schema>>|undefined} */
  // #source
  // get source() {
  //   if (!this.#source) {
  //     this.self = this
  //     this.#source = this.compile()
  //     this.self = null
  //   }
  //   return this.#source
  // }

  // /** @type {Analyzer.DeductiveRule<API.InferSchemaAttributes<Schema>>|undefined} */
  // #form

  // get form() {
  //   const form = this.#form
  //   if (form) {
  //     return form
  //   } else {
  //     const form = Analyzer.rule(this.source)
  //     this.#form = form
  //     return form
  //   }
  // }

  /** @type {Analyzer.DeductiveRule<API.InferSchemaAttributes<Schema>>|undefined} */
  #build
  build() {
    if (!this.#build) {
      this.self = this

      const when = /** @type {Record<string, API.Every>} */ ({})
      for (const [name, disjunct] of iterateDisjuncts(
        this.compile(this.cells)
      )) {
        when[name] = /** @type {[API.Conjunct, ...API.Conjunct[]]} */ ([
          ...iterateConjuncts(disjunct),
        ])
      }

      this.#build = Analyzer.rule({
        match: this.premise.attributes,
        when: /** @type {API.Some} */ (when),
      })

      this.self = null
    }

    return this.#build
  }

  /**
   * @param {API.InferSchemaTerms<Schema>} terms
   * @returns {Analyzer.RuleApplication<API.InferSchemaAttributes<Schema>>}
   */
  apply(terms) {
    return this.build().apply(terms)
  }

  /**
   * @param {API.InferFactTerms<Schema>} terms
   * @returns {API.MatchView}
   */
  recur(terms) {
    return [
      /** @type {API.Recur} */ ({
        recur: terms,
      }),
    ]
  }

  /**
   * @param {API.InferClaimTerms<Schema>} terms
   */
  induce(terms) {
    const { premise, cells } = this
    const { schema, the } = premise
    const predicates = []
    for (const [name, member] of Object.entries(schema)) {
      const [term, cell] = [terms[name], cells[name]]
      // If `this` was not provided we derive one from the data itself.
      if (name === 'this' && !term) {
        predicates.push(
          Data.Fact({
            .../** @type {Record<string, API.Term>} */ (terms),
            the,
            this: cells.this,
          })
        )
      } else {
        predicates.push(
          ...same({ this: /** @type {API.Scalar} */ (term), as: cell })
        )
      }
    }

    return new Constraint(predicates)
  }

  /**
   * @param {Partial<API.InferFactTerms<Schema>>} [terms]
   * @returns {FactMatch<Fact, The, Schema>}
   */
  match(terms) {
    // 🤔 If it is recursion we can't just generate new variables
    // we need to reuse ones from the current context.
    const { premise, conclusion, self } = this
    const match =
      self ?
        new Recur(premise, conclusion, self ?? this, {
          ...this.attributes,
          ...terms,
        })
      : new FactMatch(
          premise,
          conclusion,
          self ?? this,
          completeTerms(premise.schema, terms)
        )
    return match
  }

  /**
   * Creates a predicate for this fact that excludes ones that match given
   * terms.
   *
   * @param {Partial<API.InferSchemaTerms<Schema>>} terms
   * @returns {Negation<Fact, The, Schema>}
   */
  not(terms) {
    return new Negation(this.premise, this.conclusion, this, terms)
  }

  /**
   * Asserts this fact with a given data. If data does not conforms this fact
   * throws an error.
   *
   * @param {API.InferAssert<Schema>} fact
   * @returns {Fact}
   */
  assert(fact) {
    return this.conclusion.assert(fact)
  }

  /**
   * @param {API.InferClaimTerms<Schema>} fact
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
   * @template {API.Selector} Terms
   * @param {API.ProjectionBuilder<Schema & Context, Terms>} compile
   * @returns {Select<The, Schema, Context, Terms>}
   */
  select(compile = (variables) => /** @type {Terms} */ (variables)) {
    return new Select(this.premise, this.build(), this.cells, compile)
  }

  /**
   * Defines local variables so they could be used in the `.when` and `.where`
   * methods without makeing those part of the fact.
   *
   * @template {Omit<API.RuleDescriptor, keyof Schema | keyof Context>} Extension
   * @param {Extension} extension
   * @returns {API.Claim<Fact, The, Schema, Context & Extension>}
   */
  with(extension) {
    return new Premise(this.premise, this.conclusion, {
      ...this.context,
      ...extension,
    })
  }

  /**
   * Defines a rule that deduces this fact whenever any of the branches are true.
   * Takes a `build` function that will be given set of variables corresponding
   * to the fact members which must return object where keys represent disjuncts
   * and values are arrays representing conjuncts for those disjuncts. In other
   * works each member of the returned object represent OR branches where each
   * branch is an AND joined predicates by passed variables.
   *
   * @param {API.SomeBuilder<Schema & Context>} compile
   * @returns {API.Deduction<Fact, The, Schema, Context>}
   */
  when(compile) {
    return new Deduction(this.premise, this.conclusion, this.context, compile)
  }

  /**
   * Defines a rule that dudces this fact whenever all of the predicates are
   * true. This is a shortuct of `.when` which is convinient in cases where
   * only one branch is needed.
   *
   * @param {API.EveryBuilder<Schema & Context>} compile
   * @returns {Deduction<Fact, The, Schema, Context>}
   */
  where(compile) {
    return new Deduction(this.premise, this.conclusion, this.context, compile)
  }

  /** @type {Induction<Fact, The, Schema, Context>|undefined} */
  #induction
  get inductive() {
    if (!this.#induction) {
      const { self } = this
      const induction = new Induction(
        this.premise,
        this.conclusion,
        this.context,
        this.compile
      )
      this.self = induction
      // Force induction compilaction so that it will be the self in the given
      // context.
      induction.build()
      // Then we reset the self so that it continues to behave as intended.
      this.self = self
      // cache the instance
      this.#induction = induction
    }

    return this.#induction
  }
}

/**
 * @template Fact
 * @template {string} The
 * @template {API.RuleDescriptor & {this: ObjectConstructor}} Schema
 * @template {API.RuleDescriptor} Locals
 * @extends {Deduction<Fact, The, Schema, Locals>}
 */
class Induction extends Deduction {
  /**
   * @param {API.InferSchemaTerms<Schema>} terms
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
   * @param {Analyzer.DeductiveRule<API.InferSchemaAttributes<Schema>>} rule
   * @param {API.InferSchemaTerms<Schema>} terms
   */
  constructor(rule, terms) {
    this.rule = rule
    this.terms = terms
  }

  /** @type {Analyzer.RuleApplication<API.InferSchemaAttributes<Schema>>|undefined} */
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

  /** @type {Analyzer.RuleApplicationPlan<API.InferSchemaAttributes<Schema>>|undefined} */
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
 * @template Fact
 * @template {string} The
 * @template {API.RuleDescriptor & {this: ObjectConstructor}} Schema
 * @implements {API.MatchView<unknown>}
 */
class FactMatch {
  /**
   * @param {API.Premise<The, Schema>} premise
   * @param {API.Conclusion<Fact, The, Schema>} conclusion
   * @param {Circuit<Schema, Fact>} rule
   * @param {API.InferSchemaTerms<Schema>} terms
   */
  constructor(premise, conclusion, rule, terms) {
    this.premise = premise
    this.conclusion = conclusion
    this.rule = rule
    this.terms = terms
  }

  /**
   * @returns {Negation<Fact, The, Schema>}
   */
  negate() {
    return new Negation(this.premise, this.conclusion, this.rule, this.terms)
  }

  /** @type {Analyzer.RuleApplication<API.InferSchemaAttributes<Schema>>|undefined} */
  #build
  build() {
    if (!this.#build) {
      this.#build = this.rule.apply(this.terms)
    }
    return this.#build
  }
  /** @type {Analyzer.RuleApplicationPlan<API.InferSchemaAttributes<Schema>>|undefined} */
  #plan
  plan() {
    if (!this.#plan) {
      this.#plan = this.rule.apply(this.terms).prepare()
    }
    return this.#plan
  }

  /** @returns {Iterator<API.Conjunct|API.Recur>} */
  *[Symbol.iterator]() {
    yield this.build()
  }

  toJSON() {
    return this.build().toJSON()
  }
  /**
   * @param {API.Task<API.MatchFrame[], Error>} query
   */
  *execute(query) {
    const { terms } = this
    const selection = yield* query

    const facts = []
    for (const match of selection) {
      /** @type {Record<string, API.Scalar>} */
      const model = {}
      for (const [key, term] of Object.entries(terms)) {
        model[key] = /** @type {API.Scalar} */ (
          Variable.is(term) ? match.get(term) : term
        )
      }

      model.the = this.premise.the
      const fact = this.conclusion.assert(
        /** @type {API.InferFact<Schema> & { this: API.Entity, the: The }} */ (
          model
        )
      )

      facts.push(fact)
    }

    return facts
  }

  /**
   * @param {{ from: API.Querier }} source
   */
  query(source) {
    return Task.perform(this.execute(this.plan().query(source)))
  }
}

/**
 * Subclass of {@link FactMatch} that represents a recursive rule application.

 * @template {string} The
 * @template {API.RuleDescriptor & {this: ObjectConstructor}} Schema
 * @template Fact
 * @extends {FactMatch<Fact, The, Schema>}
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
 * @template {API.FactSchema} Schema
 */
class Fact {
  /**
   * @template {string} The
   * @template {API.FactSchema} Schema
   * @param {API.Premise<The, Schema>} premise
   * @returns {API.Conclusion<API.FactView<The, Schema>, The, Schema>}
   */
  static for({ the, schema }) {
    const This = this

    /**
     * @extends {This<The, Schema>}
     */
    class Fact extends this {
      static the = /** @type {The} */ (the)
      static schema = schema
    }

    return Fact
  }
  /**
   * @template {string} The
   * @template {API.FactSchema} Schema
   * @this {{the: The, schema: Schema} & typeof Fact} this
   * @param {Record<string, API.Scalar>} claim
   * @returns {API.FactView<The, Schema>}
   */
  static assert({ the, this: entity, ...attributes }) {
    if (the != null && the !== this.the) {
      throw new TypeError(
        `Optional attribute "the", if set must match the schema vaule "${this.the}"`
      )
    }

    // Validate that all attributes have being provided
    // TODO: Do actual schema validation to ensure tha attributes do
    // conform to the schema
    for (const name of Object.keys(this.schema)) {
      const value = attributes[name]
      if (value === undefined && name !== 'this') {
        throw new TypeError(`Required attribute "${name}" is missing`)
      }
    }

    const fact = new this(
      this.the,
      /** @type {API.Entity} */ (
        entity ?? Link.of({ ...attributes, the: this.the })
      ),
      /** @type {Omit<API.InferAssert<Schema>, 'this'|'the'>} */ (attributes)
    )

    return /** @type {API.FactView<The, Schema>} */ (fact)
  }

  /**
   * @param {The} the
   * @param {API.Entity} self
   * @param {Omit<API.InferAssert<Schema>, 'this'|'the'>} attributes
   */
  constructor(the, self, attributes) {
    this.#the = the
    this.#attributes = attributes
    this.this = self

    Object.assign(this, attributes)
  }
  #attributes
  get attributes() {
    return this.#attributes
  }

  #the
  get the() {
    return this.#the
  }

  *[Symbol.iterator]() {
    const { the, this: of } = this

    yield {
      assert: { the: `the/${the}`, of, is: the },
    }

    for (const [name, is] of Object.entries(this.#attributes)) {
      yield {
        assert: {
          the: `${the}/${name}`,
          of,
          is,
        },
      }
    }
  }

  /**
   * @returns {IterableIterator<{retract: API.Fact}>}
   */
  *retract() {
    const { the, this: of } = this
    yield {
      retract: { the: `the/${the}`, of: of, is: the },
    }

    for (const [name, value] of Object.entries(this.#attributes)) {
      if (name !== 'this' && name !== 'the') {
        yield {
          retract: { the: `${the}/${name}`, of, is: value },
        }
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
class Constraint {
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
 * @template {API.RuleDescriptor} Context
 * @template {API.Selector} Selector
 * @implements {API.Projection<Schema, Selector>}
 * @extends {Callable<(terms?: API.InferFactTerms<Schema>) => GroupedSelection<The, Schema, Selector>>}
 */
class Select extends Callable {
  /**
   * @param {API.Premise<The, Schema>} premise
   * @param {Analyzer.DeductiveRule<API.InferSchemaAttributes<Schema>>} rule
   * @param {API.InferSchemaAttributes<Schema & Context> & {_: API.Variable; this: API.Variable<API.Entity>}} cells
}}
   * @param {API.ProjectionBuilder<Schema & Context, Selector>} compile
   */
  constructor(premise, rule, cells, compile) {
    super((terms) => this.match(terms))
    this.premise = premise
    this.cells = cells
    this.rule = rule
    this.compile = compile
  }

  /** @type {Selector|undefined} */
  #build
  build() {
    if (!this.#build) {
      this.#build = this.compile(this.cells)
    }
    return this.#build
  }

  /**
   * @param {Partial<API.InferFactTerms<Schema>>} [terms]
   * @returns {GroupedSelection<The, Schema, Selector>}
   */
  match(terms) {
    return new GroupedSelection(this.premise, this.build(), this.rule, {
      ...this.cells,
      ...terms,
    })
  }
}

/**
 * @template {string} The
 * @template {API.RuleDescriptor & {this: ObjectConstructor}} Schema
 * @template {API.Selector} Selector
 */
class GroupedSelection {
  /**
   * @param {API.Premise<The, Schema>} premise
   * @param {Selector} selector
   * @param {Analyzer.DeductiveRule<API.InferSchemaAttributes<Schema>>} rule
   * @param {API.InferSchemaTerms<Schema>} terms
   */
  constructor(premise, selector, rule, terms) {
    this.premise = premise
    this.selector = selector
    this.rule = rule
    this.terms = terms
  }

  /** @type {Analyzer.RuleApplication<API.InferSchemaAttributes<Schema>>|undefined} */
  #form
  get form() {
    if (!this.#form) {
      this.#form = this.rule.apply(
        /** @type {API.InferSchemaTerms<Schema>} */ (this.terms)
      )
    }
    return this.#form
  }

  *[Symbol.iterator]() {
    yield this.form
  }

  /** @type {Analyzer.RuleApplicationPlan<API.InferSchemaAttributes<Schema>>|undefined} */
  #plan
  plan() {
    if (!this.#plan) {
      this.#plan = this.rule.apply(this.terms).prepare()
    }

    return this.#plan
  }

  toJSON() {
    return this.form.toJSON()
  }
  /**
   * @param {API.Task<API.MatchFrame[], Error>} query
   */
  *execute(query) {
    const selection = yield* query
    return Selector.select(this.selector, selection)
  }

  /**
   * @param {{ from: API.Querier }} source
   */
  query(source) {
    return Task.perform(this.execute(this.plan().query(source)))
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
 * @returns {API.InferAttributes<Schema>}
 */
function deriveAttributes(schema) {
  const match = /** @type {Record<string, API.Variable>} */ ({})
  for (const [key, type] of Object.entries(schema)) {
    match[key] = $[key]
  }
  match.this = $.this

  return /** @type {API.InferSchemaAttributes<Schema>} */ (match)
}

/**
 * @template {API.RuleDescriptor} Schema
 * @param {Schema} schema
 * @returns {API.InferSchemaAttributes<Schema> & {_: API.Variable}}
 */
function deriveCells(schema) {
  return Object.assign(deriveAttributes(schema), { _: $._ })
}

/**
 * @template {API.FactSchema} Schema
 * @param {Schema} schema
 * @param {Partial<API.InferFactTerms<Schema>>} [input]
 * @returns {API.InferSchemaTerms<Schema> & { this: API.Term<API.Entity> }}
 */
const completeTerms = (schema, input = {}) => {
  const terms = /** @type {Record<String, API.Term>} */ ({})
  for (const key of Object.keys(schema)) {
    const value = input[key]
    terms[key] = value === undefined ? $[Symbol(key)] : value
  }

  if (terms.this === undefined) {
    terms.this = $[Symbol('this')]
  }

  return /** @type {API.InferSchemaTerms<Schema> & { this: API.Term<API.Entity> }} */ (
    terms
  )
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
