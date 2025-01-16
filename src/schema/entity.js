import * as API from '../api.js'
import { Callable } from './callable.js'
import * as Term from '../term.js'
import * as Task from '../task.js'
import * as Constant from '../constant.js'
import { rule, toJSON } from '../analyzer.js'
import { scalar, unknown } from './scalar.js'
import { Variable, default as $ } from '../$.js'

/**
 * @template {API.ObjectDescriptor} Descriptor
 * @template {string} Domain
 * @param {Descriptor} descriptor
 * @param {Domain} [domain]
 * @returns {API.EntitySchema<API.InferSchemaType<Descriptor>, Descriptor, Domain>}
 */
export const entity = (descriptor, domain = /** @type {Domain} */ ('')) => {
  /** @type {API.Conjunct[]} */
  const when = []

  /** @type {API.Variable<API.Entity>} */
  const of = $[`this`]
  /** @type {Record<string, API.Variable>} */
  const match = { this: of }

  /** @type {API.EntityVariables} */
  const variables = { this: of }

  /** @type {Record<string, API.EntityMember>} */
  const members = {}

  for (const [name, member] of Object.entries(descriptor)) {
    /** @type {API.The} */
    const the =
      domain != '' ? `${domain}/${name}` : /** @type {API.The} */ (name)
    const schema = build(member)

    // If member is an entity we need to copy variables and combine the match
    if (schema.Object) {
      members[name] = schema
      // Create variables corresponding to the members cells prefixing them
      // with a name of the member.
      namespaceMatch(name, schema.rule.match, match)
      // Doing the same thing as above except above we have a flat structure
      // while here we use a nested one.
      const entityVariables = namespaceVariables(name, schema.variables)
      variables[name] = entityVariables
      // Add a clause that will join this entity to a member entity
      when.push({ match: { the, of, is: entityVariables.this } })
      // We also generate a rule application for the member entity
      when.push(schema.match(variables[name]))
    } else if (schema.Fact) {
      const fact = schema.the ? schema : schema.extend({ the })
      members[name] = fact
      namespaceMatch(name, fact.rule.match, match)
      delete match[`${name}.the`]
      match[`${name}.of`] = of

      // If value is an entity we will have bunch of variables that we'll need
      // to copy and namespace.
      const factVariables = namespaceVariables(name, fact.variables)
      variables[name] = factVariables

      if ('this' in factVariables.of) {
        factVariables.of.this = of
      } else {
        factVariables.of = of
      }

      when.push(fact.match(factVariables))
    }
    // If member is a scalar we add variables in both match and to the
    // variables
    else {
      const is = $[name]
      members[name] = /** @type {API.ScalarSchema} */ (schema)
      variables[name] = is
      match[name] = is
      when.push({ match: { the, of, is } })
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
 * @returns {API.EntityMember|API.FactSchema}
 */
export const build = (descriptor) => {
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
        : /** @type {API.FactSchema} */ (descriptor).Fact ?
          /** @type {API.FactSchema} */ (descriptor)
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
   * @param {API.EntityVariables} source.variables
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
   * @returns {API.RuleApplicationView<API.EntityView<Model>>}
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
   * @param {API.MatchFrame} bindings
   * @param {API.EntityVariables} variables
   * @returns {API.EntityView<Model>}
   */
  view(bindings, variables) {
    /** @type {Record<string, any>} */
    const model = {
      this: bindings.get(variables.this),
    }

    for (const [key, member] of Object.entries(this.members)) {
      model[key] =
        member.Object ?
          member.view(
            bindings,
            /** @type {API.EntityVariables} */ (variables[key])
          )
        : member.Fact ?
          member.view(
            bindings,
            /** @type {API.EntityVariables} */ (variables[key])
          ).is
        : bindings.get(/** @type {API.Variable} */ (variables[key]))
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
export class Query {
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
    // /** @type {API.MatchFrame} */
    // let bindings = new Map()
    // for (const [key, term] of Object.entries(this.match)) {
    //   const variable = this.rule.match[key]
    //   if (Constant.is(term)) {
    //     bindings = bindings.set(variable, term)
    //   }
    // }

    const selection = yield* this.plan.evaluate({
      source: from,
      selection: [new Map()],
    })

    const results = []
    for (const match of selection) {
      results.push(this.schema.view(match, this.schema.variables))
    }

    return results
  }
}

/**
 * @template Model
 * @extends {Query<Model>}
 */
export class EntityQuery extends Query {}

/**
 * @param {unknown} terms
 * @returns {Iterable<[string, API.Term]>}
 */
export function* iterateTerms(terms, prefix = '') {
  if (terms) {
    for (const [key, term] of Object.entries(terms)) {
      if (Term.is(term)) {
        const path = prefix === '' ? key : `${prefix}.${key}`
        yield [path, term]
      } else {
        yield* iterateTerms(term, prefix === '' ? key : `${prefix}.${key}`)
      }
    }
  }
}

/**
 * @template {API.SchemaVariables} Variables
 * @param {string} prefix
 * @param {Variables} source
 * @returns {Variables}
 */
export const namespaceVariables = (prefix, source) => {
  const variables = /** @type {API.SchemaVariables} */ ({})
  for (const [key, variable] of Object.entries(source)) {
    if (Term.is(variable)) {
      variables[key] = $[`${prefix}.${key}`]
    } else {
      variables[key] = namespaceVariables(`${prefix}.${key}`, variable)
    }
  }

  return /** @type {Variables} */ (variables)
}

/**
 * @param {string} prefix
 * @param {Record<string, API.Variable>} source
 * @param {Record<string, API.Variable>} target
 */
export const namespaceMatch = (prefix, source, target = {}) => {
  for (const key of Object.keys(source)) {
    const id = `${prefix}.${key}`
    target[id] = $[id]
  }

  return target
}
