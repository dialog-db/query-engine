import * as API from '../api.js'
import * as Constant from '../constant.js'
import { toJSON } from '../analyzer.js'
import $ from '../$.js'
import * as Variable from '../variable.js'
import * as Selector from './selector.js'
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
    this.rule = { match: {} }
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
 * @template [Model=API.InferTypeTerms<Descriptor>]
 * @extends {Schema<Model>}
 * @implements {API.EntitySchema<Model, Descriptor>}
 */
export class Entity extends Schema {
  /**
   * @param {object} source
   * @param {Descriptor} source.descriptor
   * @param {API.Deduction} source.rule
   * @param {API.InferTypeTerms<Model> & API.EntityTerms} source.selector
   * @param {Record<string, API.Schema>} source.members
   * @param {Descriptor} source.descriptor
   */
  constructor({ rule, selector, members, descriptor }) {
    super()
    this.rule = rule
    this.selector = selector
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
    /** @type {Record<string, API.Term>} */
    const match = { ...this.rule.match }
    for (const [name, term] of Selector.iterateTerms(terms)) {
      match[name] = term
    }

    return new Query({
      match: /** @type {API.InferTypeTerms<Model>} */ (match),
      schema: /** @type {API.EntitySchema<Model>} */ (this),
    })
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
    const when = []
    for (const each of derive(
      /** @type {API.InferTypeVariables<Model>} */ (this.selector)
    )) {
      if (Symbol.iterator in each) {
        when.push(...each)
      } else {
        when.push(each)
      }
    }

    // Add all the type constraints for the object members
    for (const [key, schema] of Object.entries(this.members)) {
      when.push(...schema.match(this.selector[key]))
    }

    return /** @type {API.EntitySchema<Model, Descriptor>} */ (
      new Entity({
        descriptor: this.descriptor,
        selector: this.selector,
        members: this.members,
        rule: {
          match: this.rule.match,
          when: /** @type {[API.Conjunct, ...API.Conjunct[]]} */ (when),
        },
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
