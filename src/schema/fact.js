import * as API from '../api.js'
import { Callable } from './callable.js'
import {
  build,
  namespaceTerms,
  iterateTerms,
  deriveMatch,
  Query,
} from './entity.js'
import { scalar } from './scalar.js'
import { default as $ } from '../$.js'

/**
 * @template {API.The} [The=API.The]
 * @template {API.ObjectDescriptor | API.EntitySchema} [Of={}]
 * @template {API.TypeDescriptor} [Is={Unknown:{}}]
 * @param {{the?: The, of?: Of, is?:Is}} descriptor
 * @returns {API.FactSchema<API.InferFact<{the: The, of: Of, is:Is}>>}
 */
export const fact = (descriptor) => {
  const the = $.the
  const selector = /** @type {API.FactTerms} */ ({ the: descriptor.the ?? the })

  const members = /** @type {API.FactMembers} */ ({
    the: scalar({ type: String }),
  })

  /** @type {API.Conjunct[]} */
  const when = []

  // We know this must be an entity schema because that is only thing
  // allowed in the `of`.
  const of = /** @type {API.EntitySchema} */ (build(descriptor.of ?? {}))
  members.of = of
  selector.of = namespaceTerms({ of: of.selector }).of
  when.push(...of.match(selector.of))

  const is = build(descriptor.is ?? scalar())
  members.is = is
  if (is.Object) {
    // We namespace all the terms to avoid conflicts.
    selector.is = namespaceTerms({ is: is.selector }).is

    // Add fact selection to the head, order does not matter for execution but
    // it does help when reading generated rules.
    when.unshift({ match: { the, of: selector.of.this, is: selector.is.this } })
    // Generate a conjuncts for member
    when.push(...is.match(selector.is))
  } else if (is.Fact) {
    throw new Error('Not implemented yet')
  } else {
    const term = $.is
    selector.is = term
    // Add Fact selection conjunct first
    when.unshift({ match: { the, of: selector.of.this, is: selector.is } })
    // Then all the conjuncts produced by the value
    when.push(...is.match(term))
  }

  // If attribute name in known we bind the `the` variable.
  if (descriptor.the) {
    when.push({ match: { of: descriptor.the, is: the }, operator: '==' })
  }

  return /** @type {Fact<API.InferFact<{the: The, of: Of, is:Is}>>} */ (
    new Fact(
      members,
      selector,
      {
        match: deriveMatch(selector),
        when: /** @type {API.When} */ (when),
      },
      /** @type {API.InferFact<{the: The, of: Of, is:Is}>['the']} */ (
        descriptor.the
      )
    )
  )
}

/**
 * @template {API.FactModel} Model
 * @implements {API.FactSchema<Model>}
 */
export class Fact extends Callable {
  /**
   * @param {API.FactMembers} members
   * @param {API.FactTerms} selector
   * @param {API.Deduction} rule
   * @param {Model['the']} [the]
   */
  constructor(members, selector, rule, the) {
    super(
      /**
       * @param {API.InferTypeTerms<Model>} selector
       */
      (selector) => this.match(selector)
    )
    this.members = members
    this.selector = selector
    this.rule = rule
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
    /** @type {Record<string, API.Term>} */
    const match = { ...this.rule.match }
    for (const [name, term] of iterateTerms(terms)) {
      match[name] = term
    }

    return new FactQuery({
      match: /** @type {API.InferTypeTerms<Model>} */ (match),
      schema: /** @type {any} */ (this),
    })
  }

  /**
   * @param {API.MatchFrame} bindings
   * @param {API.InferTypeTerms<Model> & {}} terms
   * @returns {API.EntityView<any>}
   */
  view(bindings, terms) {
    const { members } = this
    /** @type {Record<string, any>} */
    const model = {}

    for (const [key, selector] of Object.entries(terms)) {
      const member = members[/** @type {keyof API.FactMembers} */ (key)]
      model[key] = member.view(bindings, selector)
    }

    return /** @type {API.EntityView<any>} */ (model)
  }
}

/**
 * @template Model
 * @extends {Query<Model>}
 */
class FactQuery extends Query {}

/**
 * @template {API.The} [The=API.The]
 * @template {API.TypeDescriptor} [Is={}]
 * @param {{the: The, is?:Is}} descriptor
 */
export const is = (descriptor) => {
  const of = $.of
  const is = descriptor.is ? build(descriptor.is) : $.is

  if (descriptor.is) {
    const is = build(descriptor.is)
    if (is.Object) {
      const terms = is.selector
    } else {
    }
  }
}
