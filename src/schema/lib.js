import * as API from '../api.js'
import { This, Entity } from './entity.js'
import { Scalar, Literal } from './scalar.js'
import { Fact } from './fact.js'
import { Attribute } from './attribute.js'
import * as Selector from './selector.js'

import $ from '../$.js'

/**
 * @template {API.TypeDescriptor} T
 * @param {T} descriptor
 * @returns {API.ScalarSchema|API.EntitySchema|API.FactSchema}
 */
export const build = (descriptor) => {
  switch (descriptor) {
    case null:
      return literal(descriptor)
    case Boolean:
      return /** @type {API.ScalarSchema} */ (boolean())
    case String:
      return /** @type {API.ScalarSchema} */ (string())
    case Number:
      return /** @type {API.ScalarSchema} */ (integer())
    case BigInt:
      return /** @type {API.ScalarSchema} */ (int64())
    case Uint8Array:
      return /** @type {API.ScalarSchema} */ (bytes())
    default: {
      switch (typeof descriptor) {
        case 'boolean':
        case 'string':
        case 'number':
        case 'bigint':
          return literal(descriptor)
        case 'object': {
          const type = /** @type {any} */ (descriptor)
          return /** @type {any} */ (
            descriptor instanceof Uint8Array ? literal(descriptor)
            : type.Null ? literal(null)
            : type.Boolean ? boolean()
            : type.String ? string()
            : type.Int32 ? int32()
            : type.Int64 ? int64()
            : type.Bytes ? bytes()
            : type.Reference ? entity({})
            : entity(/** @type {API.ObjectDescriptor} */ (descriptor))
          )
        }
        case 'function': {
          return (
            /** @type {API.EntitySchema} */ (descriptor).Object ?
              /** @type {API.EntitySchema} */ (descriptor)
            : /** @type {API.FactSchema} */ (descriptor).Fact ?
              /** @type {API.FactSchema} */ (descriptor)
            : /** @type {API.ScalarSchema} */ (descriptor).Scalar ?
              /** @type {API.ScalarSchema} */ (descriptor)
            : entity({})
          )
        }
      }
    }
  }
}

/**
 * @template {string} The
 * @template {API.TypeDescriptor} Descriptor
 * @param {object} source
 * @param {The} source.the
 * @param {Descriptor} source.is
 * @returns {API.AttributeSchema<The, API.InferSchemaType<Descriptor>, API.InferSchemaView<Descriptor>>}
 */
export const attribute = ({ the, is }) => new Attribute({ the, is: build(is) })

/**
 * @template {string} The
 * @template {API.TypeDescriptor} Descriptor
 * @param {The} the
 * @param {Descriptor} type
 * @returns {API.AttributeSchema<The, API.InferSchemaType<Descriptor>, API.InferSchemaView<Descriptor>> & unique symbol}
 */
export const the = (the, type) =>
  /** @type {any} */
  (new Attribute({ the, is: build(type) }))
/**
 * @template {API.TypeDescriptor} Descriptor
 * @param {Descriptor} source
 * @returns {API.InferSchemaView<Descriptor>}
 */
export const view = (source) => {
  throw source
}
/**
 * @template {API.The} [The=API.The]
 * @template {API.ObjectDescriptor | API.EntitySchema} [Of={}]
 * @template {API.TypeDescriptor} [Is={Unknown:{}}]
 * @param {{the?: The, of?: Of, is?:Is}} descriptor
 * @returns {API.FactSchema<API.InferFact<{the: The, of: Of, is:Is}>>}
 */
export const fact = (descriptor) => {
  const members = /** @type {API.FactMembers} */ ({
    the: descriptor.the ? literal(descriptor.the) : string(),
  })

  const selector = /** @type {API.FactTerms} */ ({
    the: descriptor.the ?? members.the.selector,
  })

  const the = descriptor.the ?? selector.the

  /** @type {API.Conjunct[]} */
  const where = []

  // We know this must be an entity schema because that is only thing
  // allowed in the `of`.
  const of = /** @type {API.EntitySchema} */ (build(descriptor.of ?? {}))
  members.of = of
  selector.of = Selector.namespaceTerms({ of: of.selector }).of
  where.push(...of.match(selector.of))

  const is = descriptor.is === undefined ? scalar() : build(descriptor.is)
  members.is = is
  if (is.Object) {
    // We namespace all the terms to avoid conflicts.
    selector.is = Selector.namespaceTerms({
      is: /** @type {API.EntityTerms} */ (is.selector),
    }).is

    // Add fact selection to the head, order does not matter for execution but
    // it does help when reading generated rules.
    where.unshift({
      match: { the, of: selector.of.this, is: selector.is.this },
    })
    // Generate a conjuncts for member
    where.push(...is.match(selector.is))
  } else if (is.Fact) {
    throw new Error('Not implemented yet')
  } else {
    const term = $.is
    selector.is = term
    // Add Fact selection conjunct first
    where.unshift({ match: { the, of: selector.of.this, is: selector.is } })
    // Then all the conjuncts produced by the value
    where.push(...is.match(term))
  }

  // If attribute name in known we bind the `the` variable.
  if (descriptor.the) {
    where.push({ match: { of: descriptor.the, is: the }, operator: '==' })
  }

  return /** @type {Fact<API.InferFact<{the: The, of: Of, is:Is}>>} */ (
    new Fact(
      members,
      selector,
      /** @type {API.Conjunct[]} */ (where),
      /** @type {API.InferFact<{the: The, of: Of, is:Is}>['the']} */ (
        descriptor.the
      )
    )
  )
}

/**
 * @template {API.ObjectDescriptor} Descriptor
 * @param {Descriptor} descriptor
 * @returns {API.EntitySchema<API.InferSchemaType<Descriptor>, Descriptor>}
 */
export const entity = (descriptor) => {
  /** @type {API.Conjunct[]} */
  const where = []

  /** @type {API.Variable<API.Entity>} */
  const of = This.this.selector

  const selector =
    /** @type {API.InferTypeTerms<API.InferSchemaType<Descriptor>> & API.EntityTerms} */ ({
      this: of,
    })

  /** @type {Record<string, API.Schema>} */
  const members = {
    this: This.this,
  }

  const relations = Object.entries(descriptor)
  for (const [name, member] of relations) {
    /** @type {API.The} */
    const the = /** @type {API.The} */ (name)
    const schema = build(member)

    // If member is an entity we need to copy variables and combine the match
    if (schema.Object) {
      // Doing the same thing as above except above we have a flat structure
      // while here we use a nested one.
      const terms = Selector.namespaceTerms({ [name]: schema.selector })
      // Create variables corresponding to the members cells prefixing them
      // with a name of the member.
      // Object.assign(match, deriveMatch(terms))

      selector[name] = terms[name]
      // Add a clause that will join this entity to a member entity
      where.push({ match: { the, of, is: terms[name].this } })
      // We also generate a rule application for the member entity
      where.push(...schema.match(terms[name]))

      // members[name] = new EntityViewer(schema, terms[name])
      members[name] = schema
    } else if (schema.Fact) {
      const terms = Selector.namespaceTerms({ [name]: schema.selector.is })
      selector[name] = terms[name]

      where.push(
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
      const terms = Selector.namespaceTerms({ [name]: schema.selector })

      selector[name] = terms[name]
      where.push({ match: { the, of, is: terms[name] } })
      where.push(...schema.match(terms[name]))
      members[name] = schema
    }
  }

  // // If entity had no relations it is effectively an any entity and we ensure
  // // to add a conjunct to reflect this.
  // if (when.length === 0) {
  //   when.push({ match: { of: selector.this } })
  // }

  return /** @type {API.EntitySchema<API.InferSchemaType<Descriptor>, Descriptor>} */ (
    new Entity({
      descriptor,
      members,
      selector,
      where,
    })
  )
}

/**
 * @template {API.Scalar} T
 * @param {T} literal
 * @returns {API.ScalarSchema<T>}
 */
export const literal = (literal) => new Literal(literal, $[`the`])

/**
 * @param {{ implicit?: API.Scalar }} [options]
 * @returns {API.ScalarSchema<API.Scalar>}
 */
export const scalar = (options) =>
  new Scalar(undefined, $['scalar'], options?.implicit)

/**
 * @param {{implicit?: boolean}} [options]
 * @returns {API.ScalarSchema<boolean>}
 */
export const boolean = (options) =>
  new Scalar('boolean', $['boolean'], options?.implicit)

/**
 * @param {{implicit?: string}} [options]
 * @returns {API.ScalarSchema<string>}
 */
export const string = (options = {}) =>
  new Scalar('string', $['string'], options?.implicit)

/**
 * @param {{implicit: API.Int32}} [options]
 * @returns {API.ScalarSchema<API.Int32>}
 */
export const int32 = (options) =>
  new Scalar('int32', $['int32'], options?.implicit)

/**
 * @param {{implicit: API.Int64}} [options]
 * @returns {API.ScalarSchema<API.Int64>}
 */
export const int64 = (options) =>
  new Scalar('int64', $['int64'], options?.implicit)

/**
 * @param {{implicit: API.Float32}} options
 * @returns {API.ScalarSchema<API.Float32>}
 */
export const float32 = (options) =>
  new Scalar('float32', $['float32'], options?.implicit)

/**
 * @param {{implicit?: Uint8Array}} [options]
 * @returns {API.ScalarSchema<Uint8Array>}
 */
export const bytes = (options) =>
  new Scalar('bytes', $['bytes'], options?.implicit)

export const decimal = float32

export const integer = int32

/**
 * @param {API.TypeDescriptor} descriptor
 * @returns {API.TypeName|'object'}
 */
export const typeOf = (descriptor) => {
  switch (descriptor) {
    case null:
      return 'null'
    case globalThis.Boolean:
      return 'boolean'
    case String:
      return 'string'
    case Number:
      return 'int32'
    case BigInt:
      return 'int64'
    case Uint8Array:
      return 'bytes'
    default: {
      switch (typeof descriptor) {
        case 'boolean':
          return 'boolean'
        case 'string':
          return 'string'
        case 'number':
          return (
            !Number.isInteger(descriptor) ? 'float32'
            : descriptor < 2 ** 31 ? 'int32'
            : 'int64'
          )
        case 'bigint':
          return 'int64'
      }

      const type = /** @type {Record<string, unknown>} */ (descriptor)
      if (type.Null) {
        return 'null'
      } else if (type.Boolean) {
        return 'boolean'
      } else if (type.String) {
        return 'string'
      } else if (type.Int32) {
        return 'int32'
      } else if (type.Int64) {
        return 'int64'
      } else if (type.Float32) {
        return 'float32'
      } else if (type.Bytes) {
        return 'bytes'
      } else if (type.Reference) {
        return 'reference'
      } else {
        return 'object'
      }
    }
  }
}
