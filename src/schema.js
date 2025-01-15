import * as API from './api.js'
import { default as $ } from './$.js'
import { scalar, unknown } from './schema/scalar.js'
import { entity } from './schema/entity.js'
export * from './schema/fact.js'

export { scalar, unknown, entity }
/**
 * @template {API.The} The
 * @param {API.AttributeDescriptor<The>} options
 * @returns {API.ScalarSchema<null, The>}
 */
export const nil = ({ the } = {}) => scalar({ type: null, the })

/**
 * @template {API.The} The
 * @param {API.AttributeDescriptor<The>} options
 * @returns {API.ScalarSchema<boolean, The>}
 */
export const boolean = ({ the } = {}) => scalar({ type: Boolean, the })

/**
 * @template {API.The} The
 * @param {API.AttributeDescriptor<The>} options
 * @returns {API.ScalarSchema<string, The>}
 */
export const string = ({ the } = {}) => scalar({ type: String, the })

/**
 * @template {API.The} The
 * @param {API.AttributeDescriptor<The>} options
 * @returns {API.ScalarSchema<API.Int32, The>}
 */
export const int32 = ({ the } = {}) => scalar({ type: { Int32: {} }, the })

export const integer = int32

/**
 * @template {API.The} The
 * @param {API.AttributeDescriptor<The>} options
 * @returns {API.ScalarSchema<API.Int64, The>}
 */
export const int64 = ({ the } = {}) => scalar({ type: { Int64: {} }, the })

/**
 * @template {API.The} The
 * @param {API.AttributeDescriptor<The>} options
 * @returns {API.ScalarSchema<API.Float32, The>}
 */
export const float32 = ({ the } = {}) => scalar({ type: { Float32: {} }, the })

export const decimal = float32

/**
 * @template {API.The} The
 * @param {API.AttributeDescriptor<The>} options
 * @returns {API.ScalarSchema<Uint8Array, The>}
 */
export const bytes = ({ the } = {}) => scalar({ type: { Bytes: {} }, the })

/**
 * @template {API.SchemaDescriptor} Descriptor
 * @param {Descriptor} descriptor
 * @returns {API.InferSchema<Descriptor>}
 */
export const schema = (descriptor) =>
  /** @type {Record<keyof Descriptor, any>} */ (
    Object.fromEntries(
      Object.entries(descriptor).map(([domain, descriptor]) => [
        domain,
        entity(descriptor, domain),
      ])
    )
  )

/**
 * Rule that checks that given entity has a value of a given type under a given
 * attribute.
 */
const TypedValue = /** @type {const} */ ({
  match: {
    the: $.the,
    of: $.of,
    is: $.is,
    type: $.type,
  },
  when: [
    { match: { the: $.the, of: $.of, is: $.is } },
    { match: { of: $.is, is: $.type }, operator: 'data/type' },
  ],
})

const ImplicitTypedValue = /** @type {const} */ ({
  match: {
    the: $.the,
    of: $.of,
    is: $.is,
    implicit: $.implicit,
    type: $.type,
  },
  when: {
    explicit: [
      { match: { the: $.the, of: $.of, is: $.is } },
      { match: { of: $.is, is: $.type }, operator: 'data/type' },
    ],
    implicit: [
      { not: { match: { the: $.the, of: $.of, is: $._ } } },
      { match: { of: $.implicit, is: $.is }, operator: '==' },
    ],
  },
})
