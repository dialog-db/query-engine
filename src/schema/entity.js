import * as API from '../api.js'
import * as Constant from '../constant.js'
import { toJSON } from '../analyzer.js'
import $ from '../$.js'
import * as Variable from '../variable.js'
import { Schema } from './schema.js'
import { Query } from './query.js'

/**
 * @implements {API.Schema<API.Entity>}
 * @extends {Schema<API.Entity>}
 */
export class This extends Schema {
  static this = new This()
  constructor() {
    super()

    this.selector = $.this
  }
  /** @type {API.Conjunct[]} */
  get where() {
    return []
  }
  /**
   * @param {API.MatchFrame} match
   * @param {API.Term<API.Entity>} selector
   * @returns {API.Entity}
   */
  view(match, selector) {
    return Variable.is(selector) ?
        /** @type {API.Entity} */ (match.get(selector))
      : selector
  }
}

/**
 * @template {API.ObjectDescriptor} Descriptor
 * @template [Model=API.InferTypeTerms<Descriptor> & {}]
 * @extends {Schema<Model>}
 * @implements {API.EntitySchema<Model, Descriptor>}
 */
export class Entity extends Schema {
  /**
   * @param {object} source
   * @param {Descriptor} source.descriptor
   * @param {API.InferTypeTerms<Model> & API.EntityTerms} source.selector
   * @param {API.Conjunct[]} source.where
   * @param {Record<string, API.Schema>} source.members
   * @param {Descriptor} source.descriptor
   */
  constructor({ selector, where, members, descriptor }) {
    super()
    this.selector = selector
    this.where = where
    this.members = members
    this.descriptor = descriptor
  }
  get Object() {
    return this.descriptor
  }

  /**
   * @param {Model & {this: API.Entity}} model
   * @returns {API.EntityView<Model>}
   */
  new(model) {
    return /** @type {API.EntityView<Model>} */ (model)
  }

  /**
   * @param {API.InferTypeTerms<Model>} [terms]
   * @returns {API.RuleApplicationView<API.EntityView<Model>>}
   */
  match(terms) {
    const schema = /** @type {API.Schema<Model, API.EntityView<Model>>} */ (
      this
    )

    return new Query({ terms, schema })
  }

  /**
   * @param {API.InferTypeTerms<Model>} [terms]
   * @returns {API.Negation}
   */
  not(terms) {
    return { not: this.match(terms) }
  }

  /**
   * @param {API.MatchFrame} bindings
   * @param {API.InferTypeTerms<Model> & {}} selector
   * @returns {API.EntityView<Model>}
   */
  view(bindings, selector) {
    return /** @type {API.EntityView<Model>} */ (
      Object.fromEntries(
        Object.entries(selector).map(([key, selector]) => [
          key,
          this.members[key].view(bindings, selector),
        ])
      )
    )
  }

  /**
   * @param {(variables: API.InferTypeVariables<Model>) => Iterable<API.Conjunct|API.MatchView<unknown>>} derive
   * @returns {API.EntitySchema<Model, Descriptor>}
   */
  when(derive) {
    const where = []
    for (const each of derive(
      /** @type {API.InferTypeVariables<Model>} */ (this.selector)
    )) {
      if (Symbol.iterator in each) {
        where.push(...each)
      } else {
        where.push(each)
      }
    }

    // Add all the type constraints for the object members
    for (const [key, schema] of Object.entries(this.members)) {
      where.push(...schema.match(this.selector[key]))
    }

    return /** @type {API.EntitySchema<Model, Descriptor>} */ (
      new Entity({
        descriptor: this.descriptor,
        selector: this.selector,
        members: this.members,
        where: /** @type {[API.Conjunct, ...API.Conjunct[]]} */ (where),
      })
    )
  }

  toJSON() {
    /** @type {Record<string, {}|null>} */
    const json = {}
    for (const [key, member] of Object.entries(this)) {
      if (Constant.is(member)) {
        json[key] = Constant.toJSON(member)
      } else {
        json[key] = toJSON(member)
      }
    }

    return json
  }
}
