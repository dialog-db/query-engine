import * as API from '../api.js'
import { Callable } from './callable.js'
import * as Term from '../term.js'
import * as Bindings from '../bindings.js'
import * as Task from '../task.js'
import * as Constant from '../constant.js'
import { rule, toJSON } from '../analyzer.js'
import { scalar, unknown } from './scalar.js'
import { Variable, default as $ } from '../scope.js'

/**
 * @template {API.ObjectDescriptor} Descriptor
 * @template {string} Domain
 * @param {Descriptor} descriptor
 * @param {Domain} domain
 * @returns {API.EntitySchema<API.InferSchemaType<Descriptor>, Descriptor, Domain>}
 */
export const entity = (descriptor, domain) => {
  /** @type {API.Conjunct[]} */
  const when = []

  /** @type {API.Variable<API.Entity>} */
  const of = $[`${domain}{}`]
  /** @type {Record<string, API.Variable>} */
  const match = { this: of }

  /** @type {API.SchemaVariables} */
  const variables = { this: of }

  /** @type {Record<string, API.EntityMember>} */
  const members = {}

  for (const [name, member] of Object.entries(descriptor)) {
    const the = `${domain}/${name}`
    const is = $[name]
    const schema = build(member)

    members[name] = schema
    match[name] = is
    when.push({ match: { the, of, is } })

    // If member is an entity we need to copy variables and combine the match
    if (schema.Object) {
      // We namespace member variables to avoid conflicts when same type is
      // used on several members.
      for (const key of Object.keys(schema.rule.match)) {
        if (key !== 'this') {
          const id = `${name}.${key}`
          match[id] = $[id]
        }
      }

      // Creates namespaces variables for all the members variables so they
      // will align with variables we added to the `match`.
      variables[name] = withPrefix(name, schema.variables)
      when.push(schema.match(variables[name]))
    }
    // If member is a scalar we add variables in both match and to the
    // variables
    else {
      variables[name] = is
      when.push(schema.match(is))
    }
  }

  return /** @type {API.EntitySchema<API.InferSchemaType<Descriptor>, Descriptor, Domain>} */ (
    new Entity({
      domain,
      descriptor,
      members,
      variables,
      rule: {
        match,
        when: /** @type {API.When} */ (when),
      },
    })
  )
}

/**
 * @param {API.TypeDescriptor} descriptor
 * @returns {API.EntityMember}
 */
const build = (descriptor) => {
  switch (descriptor) {
    case null:
    case Boolean:
    case String:
    case Number:
    case BigInt:
    case Uint8Array:
      return /** @type {API.ScalarSchema} */ (scalar({ type: descriptor }))
    default: {
      return /** @type {API.EntityMember} */ (
        /** @type {API.EntitySchema} */ (descriptor).Object ?
          /** @type {API.EntitySchema} */ (descriptor)
        : Object.keys(descriptor).length === 0 ? unknown()
        : entity(/** @type {API.ObjectDescriptor} */ (descriptor), '')
      )
    }
  }
}

/**
 * @template {API.ObjectDescriptor} Descriptor
 * @template {string} Domain
 * @template [Model=API.InferTypeTerms<Descriptor>]
 * @implements {API.EntitySchema<Model, Descriptor, Domain>}
 */
export class Entity extends Callable {
  /**
   * @param {object} source
   * @param {Descriptor} source.descriptor
   * @param {Domain} source.domain
   * @param {API.Deduction} source.rule
   * @param {API.SchemaVariables} source.variables
   * @param {Record<string, API.EntityMember>} source.members
   * @param {Descriptor} source.descriptor
   */
  constructor({ domain, rule, variables, members, descriptor }) {
    super(
      /** @type {API.EntitySchema<Model, Descriptor, Domain>['match']} */
      (terms) => this.match(terms)
    )
    this.domain = domain
    this.rule = rule
    this.variables = variables
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
   * @returns {API.RuleApplicationView<Model>}
   */
  match(terms) {
    /** @type {Record<string, API.Term>} */
    const match = { ...this.rule.match }
    for (const [name, term] of iterateTerms(terms)) {
      match[name] = term
    }

    return new EntityQuery({
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
   * @param {API.Bindings} bindings
   * @param {API.SchemaVariables} variables
   * @returns {API.EntityView<Model>}
   */
  view(bindings, variables) {
    /** @type {Record<string, any>} */
    const model = {
      this: Bindings.get(bindings, variables.this),
    }

    for (const [key, member] of Object.entries(this.members)) {
      model[key] =
        member.Object ?
          member.view(
            bindings,
            /** @type {API.SchemaVariables} */ (variables[key])
          )
        : Bindings.get(bindings, /** @type {API.Variable} */ (variables[key]))
    }

    return /** @type {API.EntityView<Model>} */ (model)
  }

  /**
   * @param {(variables: API.InferTypeVariables<Model>) => Iterable<API.Conjunct>} derive
   * @returns {API.EntitySchema<Model, Descriptor, Domain>}
   */
  when(derive) {
    const when = [
      ...derive(/** @type {API.InferTypeVariables<Model>} */ (this.variables)),
    ]

    // Add all the type constraints for the object members
    for (const [key, schema] of Object.entries(this.members)) {
      when.push(schema.match(/** @type {any} */ (this.variables[key])))
    }

    return /** @type {API.EntitySchema<Model, Descriptor, Domain>} */ (
      new Entity({
        domain: this.domain,
        descriptor: this.descriptor,
        variables: this.variables,
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

/**
 * @template Model
 * @implements {API.MatchRule}
 * @implements {API.RuleApplicationView<Model>}
 */
class EntityQuery {
  /**
   * @param {object} source
   * @param {API.InferTypeTerms<Model>} source.match
   * @param {API.EntitySchema<Model>} source.schema
   */
  constructor(source) {
    this.match =
      /** @type {API.RuleBindings<API.InferTypeVariables<Model> & API.Conclusion>} */ (
        source.match
      )
    this.schema = source.schema
    this.rule = source.schema.rule

    this.plan = rule(this.rule)
      .apply(/** @type {{}} */ (this.match))
      .plan()
  }

  /**
   * @param {{ from: API.Querier }} source
   */
  select(source) {
    return Task.perform(this.query(source))
  }

  /**
   * @param {{ from: API.Querier }} terms
   */
  *query({ from }) {
    // We set up the bindings for the terms that have being provided
    // as part of the query as those will not be set by the rule application.
    /** @type {API.Bindings} */
    let bindings = {}
    for (const [key, term] of Object.entries(this.match)) {
      const variable = this.rule.match[key]
      if (Constant.is(term)) {
        bindings = Bindings.set(bindings, variable, term)
      }
    }

    const selection = yield* this.plan.evaluate({
      source: from,
      selection: [bindings],
    })

    const results = []
    for (const match of selection) {
      results.push(this.schema.view(match, this.schema.variables))
    }

    return results
  }
}

/**
 * @param {unknown} terms
 * @returns {Iterable<[string, API.Term]>}
 */
function* iterateTerms(terms, prefix = '') {
  if (terms) {
    for (const [key, term] of Object.entries(terms)) {
      if (Term.is(term)) {
        const path =
          prefix === '' ? key
          : key === 'this' ? prefix
          : `${prefix}.${key}`
        yield [path, term]
      } else {
        yield* iterateTerms(term, prefix === '' ? key : `${prefix}.${key}`)
      }
    }
  }
}

/**
 * @param {string} prefix
 * @param {API.SchemaVariables} object
 * @returns {API.SchemaVariables}
 */
const withPrefix = (prefix, object) => {
  const prefixed = /** @type {API.SchemaVariables} */ ({})
  for (const [key, variable] of Object.entries(object)) {
    if (Term.is(variable)) {
      prefixed[key] = $[key === 'this' ? prefix : `${prefix}.${key}`]
    } else {
      prefixed[key] = withPrefix(`${prefix}.${key}`, variable)
    }
  }
  return prefixed
}
