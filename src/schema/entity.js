import * as API from '../api.js'
import { Callable } from './callable.js'
import * as Term from '../term.js'
import * as Task from '../task.js'
import * as Constant from '../constant.js'
import { rule, toJSON } from '../analyzer.js'
import { scalar, isNoop } from './scalar.js'
import { Variable, default as $ } from '../$.js'
import { is as isVariable } from '../variable.js'

/**
 * @template {API.ObjectDescriptor} Descriptor
 * @param {Descriptor} descriptor
 * @returns {API.EntitySchema<API.InferSchemaType<Descriptor>, Descriptor>}
 */
export const entity = (descriptor) => {
  /** @type {API.Conjunct[]} */
  const when = []

  /** @type {API.Variable<API.Entity>} */
  const of = $[`this`]

  const selector =
    /** @type {API.InferTypeTerms<API.InferSchemaType<Descriptor>> & API.EntityTerms} */ ({
      this: of,
    })

  /** @type {Record<string, API.Schema>} */
  const members = {
    this: This.this,
  }

  for (const [name, member] of Object.entries(descriptor)) {
    /** @type {API.The} */
    const the = /** @type {API.The} */ (name)
    const schema = build(member)

    // If member is an entity we need to copy variables and combine the match
    if (schema.Object) {
      // Doing the same thing as above except above we have a flat structure
      // while here we use a nested one.
      const terms = namespaceTerms({ [name]: schema.selector })
      // Create variables corresponding to the members cells prefixing them
      // with a name of the member.
      // Object.assign(match, deriveMatch(terms))

      selector[name] = terms[name]
      // Add a clause that will join this entity to a member entity
      when.push({ match: { the, of, is: terms[name].this } })
      // We also generate a rule application for the member entity
      when.push(...schema.match(terms[name]))

      // members[name] = new EntityViewer(schema, terms[name])
      members[name] = schema
    } else if (schema.Fact) {
      const terms = namespaceTerms({ [name]: schema.selector.is })
      selector[name] = terms[name]

      when.push(
        ...schema.match({
          of: { this: of },
          the: schema.the ?? /** @type {API.The} */ (name),
          is: terms[name],
        })
      )

      members[name] = schema.members.is
    }
    // If member is a scalar we add variables in both match and to the
    // variables
    else {
      const is = $[name]
      selector[name] = is
      // match[name] = is
      when.push({ match: { the, of, is } })
      when.push(...schema.match(is))
      members[name] = schema
    }
  }

  return /** @type {API.EntitySchema<API.InferSchemaType<Descriptor>, Descriptor>} */ (
    new Entity({
      descriptor,
      members,
      selector,
      rule: {
        match: deriveMatch(selector),
        when: /** @type {API.When} */ (when),
      },
    })
  )
}

/**
 * @implements {API.Schema<API.Entity>}
 */
class This extends Callable {
  static this = new This()
  constructor() {
    super(() => this)
  }
  /**
   * @param {API.MatchFrame} match
   * @param {API.Term<API.Entity>} selector
   * @returns {API.Entity}
   */
  view(match, selector) {
    return isVariable(selector) ?
        /** @type {API.Entity} */ (match.get(selector))
      : selector
  }
  match() {
    return []
  }
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
        : /** @type {API.ScalarSchema} */ (descriptor).Scalar ?
          /** @type {API.ScalarSchema} */ (descriptor)
        : entity(/** @type {API.ObjectDescriptor} */ (descriptor))
      )
    }
  }
}

/**
 * @template {API.ObjectDescriptor} Descriptor
 * @template [Model=API.InferTypeTerms<Descriptor>]
 * @implements {API.EntitySchema<Model, Descriptor>}
 */
export class Entity extends Callable {
  /**
   * @param {object} source
   * @param {Descriptor} source.descriptor
   * @param {API.Deduction} source.rule
   * @param {API.InferTypeTerms<Model> & API.EntityTerms} source.selector
   * @param {Record<string, API.Schema>} source.members
   * @param {Descriptor} source.descriptor
   */
  constructor({ rule, selector, members, descriptor }) {
    super(
      /** @type {API.EntitySchema<Model, Descriptor>['match']} */
      (selector) => this.match(selector)
    )
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

    this.plan = rule({
      match: this.rule.match,
      when:
        this.rule.when?.length === 0 ?
          [
            {
              match: {
                of: /** @type {API.Term<API.Entity>} */ (this.rule.match.this),
              },
            },
          ]
        : this.rule.when,
    })
      .apply(/** @type {{}} */ (this.match))
      .plan()
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
    if (this.rule.when?.length !== 0) {
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
    })

    const results = []
    for (const match of selection) {
      results.push(this.schema.view(match, this.schema.selector))
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
 * @template {API.SchemaTerms} Terms
 * @param {string} prefix
 * @param {Terms} source
 * @returns {Terms}
 */
export const namespaceTerms = (source, prefix = '') => {
  const terms = /** @type {API.SchemaTerms} */ ({})
  for (const [key, term] of Object.entries(source)) {
    if (isVariable(term)) {
      terms[key] = $[`${prefix}${key}`]
    } else if (Constant.is(term)) {
      terms[key] = term
    } else {
      terms[key] = namespaceTerms(term, `${prefix}${key}.`)
    }
  }

  return /** @type {Terms} */ (terms)
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

/**
 * @template {API.SchemaTerms|API.Term} Source
 * @param {string} prefix
 * @param {Source} source
 * @param {Record<string, API.Term>} target
 */
export const buildMatch = (prefix, source, target = {}) => {
  if (Term.is(source)) {
    target[prefix] = source
  } else {
    for (const [key, value] of iterateTerms(source)) {
      const id = `${prefix}.${key}`
      target[id] = /** @type {API.Term} */ (value)
    }
  }
  return target
}

/**
 * @template {API.SchemaTerms} Terms
 * @param {Terms} source
 * @returns {Record<string, API.Variable>}
 */
export const deriveMatch = (source) => {
  /** @type {Record<string, API.Variable>} */
  const match = {}
  for (const [key, term] of iterateTerms(source)) {
    if (isVariable(term)) {
      match[key] = term
    }
  }

  return match
}
