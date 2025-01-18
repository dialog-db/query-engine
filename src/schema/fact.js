import * as API from '../api.js'
import { Callable } from './callable.js'
import {
  build,
  namespaceTerms,
  iterateTerms,
  deriveMatch,
  entity,
  Query,
} from './entity.js'
import { scalar } from './scalar.js'
import { default as $ } from '../$.js'
import * as Variable from '../variable.js'
import * as Term from '../term.js'

/**
 * @template {API.The} [The=API.The]
 * @template {API.ObjectDescriptor | API.EntitySchema} [Of={}]
 * @template {API.TypeDescriptor} [Is={Unknown:{}}]
 * @param {{the?: The, of?: Of, is?:Is}} descriptor
 * @returns {API.FactSchema<API.InferFact<{the: The, of: Of, is:Is}>>}
 */
export const fact = ({ the: by, of, is }) => {
  const the = $.the
  /** @type {API.Select} */
  const fact = { the }
  /** @type {Record<string, API.Variable>} */
  const match = { the }
  /** @type {API.FactTerms} */
  const select = { the: by ?? the }
  /** @type {API.FactMembers} */
  const members = {}

  /** @type {API.Conjunct[]} */
  const when = [{ match: fact }]

  for (const [key, member] of Object.entries({
    of: of ?? {},
    is: is ?? scalar(),
  })) {
    const name = /** @type {'is'|'of'} */ (key)
    const schema = build(member)
    members[name] = schema

    // If member is an entity we need to copy variables and combine the match
    if (schema.Object) {
      members[name] = schema
      // Doing the same thing as above except above we have a flat structure
      // while here we use a nested one.
      const terms = namespaceTerms({ [name]: schema.terms })

      // Create variables corresponding to the members cells prefixing them
      // with a name of the member.
      Object.assign(match, deriveMatch(terms))

      select[name] = terms[name]
      // Generate a rule application for the member entity
      when.push(...schema.match(terms[name]))

      fact[name] = terms[name].this
    } else if (schema.Fact) {
      throw new Error('Not implemented yet')
    }
    // If member is a scalar we add variables in both match and to the
    // variables
    else {
      const is = $[name]
      members[name] = schema
      select[name] = is
      match[name] = is
      fact[name] = is
      when.push(...schema.match(is))
    }
  }

  // Makes sure that attribute name matches one set in the descriptor.
  if (by) {
    when.unshift({ match: { of: by, is: the }, operator: '==' })
    members.the = scalar({ type: String })
  }

  if (!select.of) {
    const of = $.of
    select.of = of
    match.of = of
    fact.of = of
  }

  if (!select.is) {
    const is = $.is
    select.is = is
    match.is = is
    fact.is = is
  }

  return /** @type {Fact<API.InferFact<{the: The, of: Of, is:Is}>>} */ (
    new Fact(
      members,
      select,
      {
        match: deriveMatch(select),
        when: /** @type {API.When} */ (when),
      },
      /** @type {API.InferFact<{the: The, of: Of, is:Is}>['the']} */ (by)
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
   * @param {API.FactTerms} terms
   * @param {API.Deduction} rule
   * @param {Model['the']} [the]
   */
  constructor(members, terms, rule, the) {
    super(
      /** @type {API.FactSchema<Model>['match']} */
      (terms) => this.match(terms)
    )
    this.members = members
    this.terms = terms
    this.rule = rule
    this.the = the
  }
  get Fact() {
    return this
  }

  /**
   * @template {Model['the'] & {}} The
   * @param {object} extension
   * @param {The} extension.the
   * @returns {API.FactSchema<Model>}
   */
  extend({ the }) {
    if (this.members.the) {
      throw new TypeError('Fact already has a `the` attribute')
    }

    return new Fact(
      this.members,
      this.terms,
      {
        match: this.rule.match,
        when: [
          {
            match: { of: the, is: this.terms.the },
            operator: '==',
          },
          // If rule had no `the` member it had no binding for it.
          .../** @type {API.Every} */ (this.rule.when),
        ],
      },
      the
    )
  }

  /**
   * @param {API.InferFactTerms<Model>} [terms]
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
   * @param {API.EntityTerms} terms
   * @returns {API.EntityView<any>}
   */
  view(bindings, terms) {
    /** @type {Record<string, any>} */
    const model = {}
    const members = /** @type {Record<string, API.EntityMember>} */ (
      this.members
    )

    for (const [key, term] of Object.entries(terms)) {
      const member = members[key]
      model[key] =
        member.Object ?
          member.view(bindings, /** @type {API.EntityVariables} */ (term))
        : Variable.is(term) ? bindings.get(/** @type {API.Variable} */ (term))
        : term
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
      const terms = is.terms
    } else {
    }
  }
}
