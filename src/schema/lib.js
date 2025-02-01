import * as API from '../api.js'
import { This, Entity } from './entity.js'
import { Scalar, The } from './scalar.js'
import { Fact } from './fact.js'
import * as Selector from './selector.js'

import $ from '../$.js'

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
      switch (typeof descriptor) {
        case 'boolean':
        case 'string':
        case 'number':
        case 'bigint':
          return /** @type {API.ScalarSchema} */ (scalar({ type: descriptor }))
        case 'object': {
          return (
            descriptor instanceof Uint8Array ? scalar({ type: descriptor })
            : descriptor.Null ? scalar({ type: descriptor })
            : descriptor.Boolean ? scalar({ type: descriptor })
            : descriptor.String ? scalar({ type: descriptor })
            : descriptor.Int32 ? scalar({ type: descriptor })
            : descriptor.Int64 ? scalar({ type: descriptor })
            : descriptor.Bytes ? scalar({ type: descriptor })
            : descriptor.Reference ? entity({})
            : /** @type {API.EntityMember} */ (
                /** @type {API.EntitySchema} */ (descriptor).Object ?
                  /** @type {API.EntitySchema} */ (descriptor)
                : /** @type {API.FactSchema} */ (descriptor).Fact ?
                  /** @type {API.FactSchema} */ (descriptor)
                : /** @type {API.ScalarSchema} */ (descriptor).Scalar ?
                  /** @type {API.ScalarSchema} */ (descriptor)
                : entity(/** @type {API.ObjectDescriptor} */ (descriptor))
              )
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
 * @template {API.The} [The=API.The]
 * @template {API.ObjectDescriptor | API.EntitySchema} [Of={}]
 * @template {API.TypeDescriptor} [Is={Unknown:{}}]
 * @param {{the?: The, of?: Of, is?:Is}} descriptor
 * @returns {API.FactSchema<API.InferFact<{the: The, of: Of, is:Is}>>}
 */
export const fact = (descriptor) => {
  const the = $.the
  const selector = /** @type {API.FactTerms} */ ({
    the: descriptor.the ?? the,
  })

  const members = /** @type {API.FactMembers} */ ({
    the: scalar({ type: String }),
  })

  /** @type {API.Conjunct[]} */
  const when = []

  // We know this must be an entity schema because that is only thing
  // allowed in the `of`.
  const of = /** @type {API.EntitySchema} */ (build(descriptor.of ?? {}))
  members.of = of
  selector.of = Selector.namespaceTerms({ of: of.selector }).of
  when.push(...of.match(selector.of))

  const is =
    descriptor.is === undefined ? scalar() : build(descriptor.is ?? scalar())
  members.is = is
  if (is.Object) {
    // We namespace all the terms to avoid conflicts.
    selector.is = Selector.namespaceTerms({ is: is.selector }).is

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
        match: Selector.deriveMatch(selector),
        when: /** @type {API.When} */ (when),
      },
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
  const when = []

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

  for (const [name, member] of Object.entries(descriptor)) {
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
      when.push({ match: { the, of, is: terms[name].this } })
      // We also generate a rule application for the member entity
      when.push(...schema.match(terms[name]))

      // members[name] = new EntityViewer(schema, terms[name])
      members[name] = schema
    } else if (schema.Fact) {
      const terms = Selector.namespaceTerms({ [name]: schema.selector.is })
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
      const terms = Selector.namespaceTerms({ [name]: schema.selector })

      selector[name] = terms[name]
      when.push({ match: { the, of, is: terms[name] } })
      when.push(...schema.match(terms[name]))
      members[name] = schema
    }
  }

  return /** @type {API.EntitySchema<API.InferSchemaType<Descriptor>, Descriptor>} */ (
    new Entity({
      descriptor,
      members,
      selector,
      rule: {
        match: Selector.deriveMatch(selector),
        when: /** @type {API.When} */ (when),
      },
    })
  )
}

/**
 * @template {API.Scalar} T
 * @param {T} literal
 */
export const the = (literal) => {
  return new The(literal, $[`the${literal}`])
}

/**
 * @template {API.ScalarDescriptor} Descriptor
 * @param {{ implicit?: API.InferSchemaType<Descriptor>, type: Descriptor}} [descriptor]
 * @returns {API.ScalarSchema<API.InferSchemaType<Descriptor>>}
 */
export const scalar = (descriptor) => {
  const type = typeOf(descriptor?.type ?? {})
  if (type === 'object') {
    return new Scalar(undefined, $['scalar'], descriptor?.implicit)
  } else {
    return new Scalar(type, $[type], descriptor?.implicit)
  }
}

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
