import * as API from '../api.js'
import { Schema } from './schema.js'
import { Query } from './query.js'

/**
 * @template {API.FactModel} Model
 * @extends {Schema<Model>}
 * @implements {API.FactSchema<Model>}
 */
export class Fact extends Schema {
  /**
   * @param {API.FactMembers} members
   * @param {API.FactTerms} selector
   * @param {API.Every} where
   * @param {Model['the']} [the]
   */
  constructor(members, selector, where, the) {
    super()
    this.members = members
    this.selector = /** @type {API.InferTypeTerms<Model> & API.FactTerms} */ (
      selector
    )
    this.where = where
    this.the = the
  }
  get Fact() {
    return this
  }

  /**
   * @param {API.InferTypeTerms<Model>} [terms]
   * @returns {API.RuleApplicationView<Model>}
   */
  match(terms) {
    return new Query({
      terms,
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
