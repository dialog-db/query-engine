import * as API from '../api.js'
import { Schema } from './schema.js'
import $ from '../$.js'
import * as Selector from './selector.js'
import * as Variable from '../variable.js'
import { Query } from './query.js'
import { rule } from '../analyzer.js'
import * as Task from '../task.js'

/**
 * @template Model
 * @param {API.InferTypeTerms<Model>} selector
 * @returns {API.Term}
 */
const toValueSelector = (selector) =>
  /** @type {{this?:API.Term}} */ (selector).this ??
  /** @type {API.Term} */ (selector)

/**
 * @template {string} The
 * @template {{}|null} Model
 * @template View
 * @extends {Schema<{ of: {}, is: Model }>}
 * @implements {API.Schema<{ of: {}, is: Model }, View>}
 */
export class Attribute extends Schema {
  /**
   * @param {object} source
   * @param {The} source.the
   * @param {API.Schema<Model, View>} source.is
   */
  constructor({ the, is }) {
    super()
    this.the = the
    this.is = is

    this.members = {
      is: is,
    }

    this.selector = {
      of: { this: /** @type {API.Variable<API.Entity>} */ ($.of) },
      is: Selector.namespaceTerms({
        is: is.selector,
      }).is,
    }

    /** @type {API.Conjunct[]} */
    this.where = [
      {
        match: {
          the,
          of: this.selector.of.this,
          is: toValueSelector(this.selector.is),
        },
      },
      ...is.match(this.selector.is),
    ]
  }
  get Fact() {
    return this
  }

  /**
   * @param {{of?: { this?: API.Term<API.Entity> }, is?: API.InferTypeTerms<Model> }} [terms]
   */
  match2(terms = {}) {
    const of = terms.of?.this
    const is = terms.is

    const factSelector = {
      match: {
        the: this.the,
        ...(of ? { of } : null),
        ...(is ? { is: toValueSelector(/** @type {{}} */ (is)) } : null),
      },
    }

    const isSelector = is ? this.is.match(is) : []

    const match = Selector.deriveMatch(terms)

    return rule({
      match,
      when: {
        where: [factSelector, ...isSelector],
      },
    }).apply(match)
  }

  /**
   * @returns {API.Schema<{ of: {}, is: Model }, View>}
   */
  get schema() {
    return this
  }
  /**
   * @param {{of?: { this?: API.Term<API.Entity> }, is?: API.InferTypeTerms<Model> }} [selector]
   */
  match(selector) {
    return new Query({
      terms: { ...selector },
      schema: this.schema,
    })
  }

  /**
   * @param {View} value
   */
  implicit(value) {
    return new ImplicitAttribute({
      the: this.the,
      is: this.is,
      implicit: value,
    })
  }

  /**
   * @param {API.MatchFrame} bindings
   * @param {{ of: {this: API.Term<API.Entity>}, is: API.InferTypeTerms<Model> }} selector
   * @returns {View}
   */
  view(bindings, selector) {
    return this.is.view(bindings, selector.is)
  }

  /**
   * @param {(variables: API.InferTypeVariables<Model>) => Iterable<API.Conjunct|API.MatchView<unknown>>} derive
   * @returns {API.Schema<{ of: {this: API.Entity}, is: Model }, View>} derive
   */
  when(derive) {
    return this
  }

  get [Symbol.toPrimitive]() {
    return this.the
  }
}

/**
 * @template {string} The
 * @template {{}|null} Model
 * @template View
 * @extends {Schema<{ of: { this: API.Entity }, is: Model }>}
 * @implements {API.Schema<{ of: { this: API.Entity }, is: Model }, View>}
 */
class ImplicitAttribute extends Schema {
  /**
   * @param {object} source
   * @param {The} source.the
   * @param {API.Schema<Model, View>} source.is
   * @param {View} source.implicit
   */
  constructor({ the, is, implicit }) {
    super()
    this.the = the
    this.is = is
    this.default = implicit

    /** @type {{of: { this: API.Term<API.Entity> }, is: API.InferTypeTerms<Model>}} */
    this.selector = {
      of: { this: $.of },
      is: Selector.namespaceTerms({
        is: is.selector,
      }).is,
    }

    /** @type {API.Conjunct[]} */
    this.where = []
  }

  /**
   * @returns {API.Schema<{ of: {}, is: Model }, View>}
   */
  get schema() {
    return this
  }
  /**
   * @param {{of?: { this?: API.Term<API.Entity> }, is?: API.InferTypeTerms<Model> }} [selector]
   * @returns {API.RuleApplicationView<View>}
   */
  match(selector) {
    return new ImplicitQuery({
      the: this.the,
      implicit: this.default,
      terms: { ...selector },
      selector: this.selector,
      schema: this.schema,
      is: this.is,
    })
  }

  /**
   * @param {API.MatchFrame} bindings
   * @param {{of: { this: API.Term<API.Entity> }, is: API.InferTypeTerms<Model> }} selector
   * @returns {View}
   */
  view(bindings, selector) {
    return this.is.view(bindings, selector.is)
  }
}

/**
 * @template {{}|null} Model
 * @template View
 * @implements {API.RuleApplicationView<View>}
 */
class ImplicitQuery {
  /**
   * @param {object} source
   * @param {string} source.the
   * @param {{of?: { this?: API.Term<API.Entity> }, is?: API.InferTypeTerms<Model>}} [source.terms]
   * @param {API.Schema<{of: {}, is: Model}, View>} source.schema
   * @param {API.Schema<Model, View>} source.is
   * @param {{of: { this: API.Term<API.Entity> }, is: API.InferTypeTerms<Model>}} source.selector
   * @param {View} source.implicit
   */
  constructor({ terms, the, schema, is, implicit, selector }) {
    this.terms = terms
    this.schema = schema
    this.is = is
    this.implicit = implicit

    const match = Selector.deriveMatch(selector)
    this.match = match

    /** @type {Record<string, API.Term>} */
    const application = { ...match }
    for (const [name, term] of Selector.iterateTerms(terms)) {
      application[name] = term
    }

    this.rule = {
      match,
      when: {
        Explicit: /** @type {API.Every} */ ([
          {
            match: {
              the,
              of: selector.of.this,
              is: toValueSelector(selector.is),
            },
          },
          ...is.match(selector.is),
        ]),

        Implicit: /** @type {API.Every} */ ([
          { not: { match: { the, of: selector.of.this } } },
          // effectively mark of as input
          {
            match: { of: selector.of.this, is: 'reference' },
            operator: 'data/type',
          },
          ...deriveBindings(
            selector.is,
            /** @type {API.Scalar|Structure} */ (this.implicit)
          ),
        ]),
      },
    }

    this.plan = rule(this.rule)
      .apply(/** @type {{}} */ (application))
      .prepare()
  }

  toSource() {
    return this.plan.toDebugString()
  }

  /**
   * @param {{ from: API.Querier }} source
   */
  select(source) {
    return Task.perform(this.query(source))
  }

  *[Symbol.iterator]() {
    if (this.schema.where.length !== 0) {
      yield {
        match: this.match,
        rule: this.rule,
      }
    }
  }

  /**
   * @param {{ from: API.Querier }} terms
   */
  *query({ from }) {
    const selection = yield* this.plan.evaluate({
      source: from,
      selection: [new Map()],
      self: this.plan.plan,
      recur: [],
    })

    const results = []
    for (const match of selection) {
      results.push(this.schema.view(match, this.schema.selector))
    }

    return results
  }
}

/**
 * @typedef {{[key:string]: API.Scalar|Structure}} Structure
 */
/**
 * @param {API.Term|API.SchemaTerms} terms
 * @param {API.Scalar|Structure} implicit
 * @returns {Iterable<API.Conjunct>}
 */
const deriveBindings = function* (terms, implicit) {
  if (Variable.is(terms)) {
    yield /** @type {API.SystemOperator} */ ({
      match: { of: /** @type {API.Scalar} */ (implicit), is: terms },
      operator: '==',
    })
  } else {
    for (const [key, term] of Object.entries(
      /** @type {API.SchemaTerms} */ (terms)
    )) {
      yield* deriveBindings(
        /** @type {API.Term|API.SchemaTerms} */ (term),
        /** @type {Structure} */ (implicit)[key]
      )
    }
  }
}
