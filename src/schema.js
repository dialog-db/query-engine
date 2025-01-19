import * as API from './api.js'
import { default as $ } from './$.js'
import { scalar } from './schema/scalar.js'
import { entity } from './schema/entity.js'
export * from './schema/fact.js'

export { scalar, entity }

/**
 * @param {{implicit?: null}} [options]
 * @returns {API.ScalarSchema<null>}
 */
export const nil = (options) => scalar({ ...options, type: null })

/**
 * @template {API.The} The
 * @param {{implicit?: boolean}} options
 * @returns {API.ScalarSchema<boolean>}
 */
export const boolean = (options) => scalar({ ...options, type: Boolean })

/**
 * @param {{implicit?: string}} [options]
 * @returns {API.ScalarSchema<string>}
 */
export const string = (options) => scalar({ ...options, type: String })

/**
 * @template {API.The} The
 * @param {{implicit: API.Int32}} [options]
 * @returns {API.ScalarSchema<API.Int32>}
 */
export const int32 = (options) => scalar({ ...options, type: { Int32: {} } })

export const integer = int32

/**
 * @param {{implicit: API.Int64}} [options]
 * @returns {API.ScalarSchema<API.Int64>}
 */
export const int64 = (options) => scalar({ type: { Int64: {} }, ...options })

/**
 * @template {API.The} The
 * @param {{implicit: API.Float32}} options
 * @returns {API.ScalarSchema<API.Float32>}
 */
export const float32 = (options) =>
  scalar({ ...options, type: { Float32: {} } })

export const decimal = float32

/**
 * @param {{implicit?: Uint8Array}} options
 * @returns {API.ScalarSchema<Uint8Array>}
 */
export const bytes = (options) => scalar({ ...options, type: { Bytes: {} } })

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
