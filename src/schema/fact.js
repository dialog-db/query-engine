import * as API from '../api.js'
import { Schema } from './schema.js'
import { Query } from './query.js'
import * as Selector from './selector.js'

/**
 * @template {API.FactModel} Model
 * @extends {Schema<Model>}
 * @implements {API.FactSchema<Model>}
 */
export class Fact extends Schema {
  /**
   * @param {API.FactMembers} members
   * @param {API.FactTerms} selector
   * @param {API.Deduction} rule
   * @param {Model['the']} [the]
   */
  constructor(members, selector, rule, the) {
    super()
    this.members = members
    this.selector = /** @type {API.InferTypeTerms<Model> & API.FactTerms} */ (
      selector
    )
    this.rule = rule
    this.the = the
  }
  get Fact() {
    return this
  }

  /**
   * @template Implicit
   * @param {Implicit} value
   * @returns {API.Schema<Model, { the: Model['the'], of: Model['of'], is: Model['value']|Implicit }>}
   */
  implicit(value) {
    // return new Implicit(this, value)
    const self = /** @type {API.FactSchema<Model>} */ (this)
    const implicit = new Implicit(self, value)
    return implicit
  }
  /**
   * @param {API.InferTypeTerms<Model>} [terms]
   * @returns {API.RuleApplicationView<Model>}
   */
  match(terms) {
    /** @type {Record<string, API.Term>} */
    const match = { ...this.rule.match }
    for (const [name, term] of Selector.iterateTerms(terms)) {
      match[name] = term
    }

    return new Query({
      match: /** @type {API.InferTypeTerms<Model>} */ (match),
      schema: /** @type {any} */ (this),
    })
  }

  /**
   * @param {API.MatchFrame} bindings
   * @param {API.InferTypeTerms<Model> & {}} selector
   * @returns {Model}
   */
  view(bindings, selector) {
    const { members } = this
    /** @type {Record<string, any>} */
    const model = {}

    for (const [key, terms] of Object.entries(selector)) {
      const member = members[/** @type {keyof API.FactMembers} */ (key)]
      model[key] = member.view(bindings, terms)
    }

    return /** @type {API.EntityView<any>} */ (model)
  }
}

/**
 * @template {API.FactModel} Model
 * @template Implicit
 * @extends {Schema<Model>}
 * @implements {API.Schema<Model, { the: Model['the'], of: Model['of'], is: Model['is']|Implicit }>}
 */
class Implicit extends Schema {
  /**
   *
   * @param {API.FactSchema<Model>} fact
   * @param {Implicit} value
   */
  constructor(fact, value) {
    super()
    this.fact = fact
    this.default = value
  }
  get selector() {
    return this.fact.selector
  }
  /**
   * @param {API.InferTypeTerms<Model>} [selector]
   * @returns {API.RuleApplicationView<{ the: Model['the'], of: Model['of'], is: Model['is']|Implicit }>}
   */
  match(selector) {
    /** @type {Record<string, API.Term>} */
    const match = { ...this.fact.rule.match }
    for (const [name, term] of Selector.iterateTerms(selector)) {
      match[name] = term
    }

    return new Query({
      match: /** @type {API.InferTypeTerms<Model>} */ (match),
      schema: /** @type {any} */ (this),
    })
  }
  /**
   * @param {API.MatchFrame} bindings
   * @param {API.InferTypeTerms<Model> & {}} terms
   * @returns {{ the: Model['the'], of: Model['of'], is: Model['is']|Implicit }}
   */
  view(bindings, terms) {
    const { members } = this.fact
    /** @type {Record<string, any>} */
    const model = {}

    for (const [key, selector] of Object.entries(terms)) {
      const member = members[/** @type {keyof API.FactMembers} */ (key)]
      if (key === 'is') {
        model[key] = member.view(bindings, selector) ?? this.default
      } else {
        model[key] = member.view(bindings, selector)
      }
    }

    return /** @type {any} */ (model)
  }
}
