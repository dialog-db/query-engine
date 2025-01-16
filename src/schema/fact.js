import * as API from '../api.js'
import { Callable } from './callable.js'
import {
  build,
  namespaceVariables,
  namespaceMatch,
  iterateTerms,
  Query,
} from './entity.js'
import { unknown, scalar } from './scalar.js'
import { Variable, default as $ } from '../$.js'
import * as Bindings from '../bindings.js'

/**
 * @template {API.The} [The=API.The]
 * @template {API.TypeDescriptor} [Of=API.ScalarSchema<API.Entity>]
 * @template {API.TypeDescriptor} [Is={}]
 * @param {{the?: The, of?: Of, is?:Is}} descriptor
 * @returns {API.FactSchema<API.InferFact<{the: The, of: Of, is:Is}>>}
 */
export const fact = ({ the: by, ...descriptor }) => {
  const the = $.the
  /** @type {API.Select} */
  const select = { the }
  /** @type {Record<string, API.Variable>} */
  const match = { the }
  /** @type {API.FactVariables} */
  const variables = { the }
  /** @type {API.FactMembers} */
  const members = {}

  /** @type {API.Conjunct[]} */
  const when = [{ match: select }]

  for (const [key, member] of Object.entries(descriptor)) {
    const name = /** @type {'is'|'of'} */ (key)
    const schema = build(member)
    members[name] = schema

    // If member is an entity we need to copy variables and combine the match
    if (schema.Object) {
      members[name] = schema
      // Create variables corresponding to the members cells prefixing them
      // with a name of the member.
      namespaceMatch(name, schema.rule.match, match)
      // Doing the same thing as above except above we have a flat structure
      // while here we use a nested one.
      const memberVariables = namespaceVariables(name, schema.variables)
      variables[name] = memberVariables
      // Generate a rule application for the member entity
      when.push(schema.match(memberVariables))

      select[name] = memberVariables.this
    }
    // If member is a scalar we add variables in both match and to the
    // variables
    else {
      const is = $[name]
      members[name] = schema
      variables[name] = is
      match[name] = is
      select[name] = is
      when.push(schema.match(is))
    }
  }

  // Makes sure that attribute name matches one set in the descriptor.
  if (by) {
    when.unshift({ match: { of: by, is: the }, operator: '==' })
    members.the = scalar({ type: String })
  }

  if (!variables.of) {
    const of = $.of
    variables.of = of
    match.of = of
    select.of = of
  }

  if (!variables.is) {
    const is = $.is
    variables.is = is
    match.is = is
    select.is = is
  }

  return new Fact(
    members,
    variables,
    {
      match,
      when: /** @type {API.When} */ (when),
    },
    /** @type {API.InferFact<{the: The, of: Of, is:Is}>['the']} */ (by)
  )
}

/**
 * @template {API.The} The
 * @template {API.FactModel} Model
 * @implements {API.FactSchema<Model>}
 */
export class Fact extends Callable {
  /**
   * @param {API.FactMembers} members
   * @param {API.FactVariables} variables
   * @param {API.Deduction} rule
   * @param {Model['the']} [the]
   */
  constructor(members, variables, rule, the) {
    super(
      /** @type {API.FactSchema<Model>['match']} */
      (terms) => this.match(terms)
    )
    this.members = members
    this.variables = variables
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
      this.variables,
      {
        match: this.rule.match,
        when: [
          {
            match: { of: the, is: this.variables.the },
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
   * @param {API.Bindings} bindings
   * @param {API.EntityVariables} variables
   * @returns {API.EntityView<any>}
   */
  view(bindings, variables) {
    /** @type {Record<string, any>} */
    const model = {}

    for (const [key, member] of Object.entries(this.members)) {
      model[key] =
        member.Object ?
          member.view(
            bindings,
            /** @type {API.EntityVariables} */ (variables[key])
          )
        : Bindings.get(bindings, /** @type {API.Variable} */ (variables[key]))
    }

    return /** @type {API.EntityView<any>} */ (model)
  }
}

/**
 * @template Model
 * @extends {Query<Model>}
 */
class FactQuery extends Query {}
