import * as API from './api.js'
import * as Link from 'multiformats/link'
import * as Bytes from './bytes.js'
import * as CBOR from '@ipld/dag-cbor'
import * as Blake3 from '@noble/hashes/blake3'
import * as Digest from 'multiformats/hashes/digest'

export * from './api.js'

/**
 * @template {{} | null} T
 * @param {unknown|API.Link<T>} value
 * @returns {value is API.Link<T>}
 */
export const is = (value) =>
  value != null && /** @type {{'/'?: {}}} */ (value)['/'] instanceof Uint8Array

/**
 * @param {API.Link} self
 * @param {API.Link} other
 * @returns {boolean}
 */
export const equal = (self, other) => Bytes.equal(self['/'], other['/'])

/**
 * @typedef {{'/': string}} JSON
 * @param {API.Link} self
 * @returns {JSON}
 */
export const toJSON = (self) => ({
  '/': Link.format(/** @type {any} */ (self)),
})

/**
 * @param {JSON} json
 * @returns {API.Link}
 */
export const fromJSON = (json) => /** @type {any} */ (Link.parse(json['/']))

/**
 * @param {API.Link} self
 */
export const toString = (self) =>
  `{"/":"${Link.format(/** @type {any} */ (self))}"}`

/**
 * @template {API.Link} Link
 * @param {Link} self
 * @returns {API.ByteView<Link>}
 */
export const toBytes = (self) => self['/']

/**
 * @param {Uint8Array} bytes
 * @returns {API.Link}
 */
export const fromBytes = (bytes) => /** @type {any} */ (Link.decode(bytes))

/**
 * @template {{}|null} Value
 * @param {Value} value
 * @returns {API.Link<Value, typeof CBOR.code, 0x1e>}
 */
export const of = (value) => {
  if (is(value)) {
    return value
  } else {
    const bytes = CBOR.encode(value)
    const digest = Blake3.blake3(bytes)
    return /** @type {any} */ (
      Link.create(CBOR.code, Digest.create(0x1e, digest))
    )
  }
}

/**
 * @param {API.Link} self
 * @param {API.Link} other
 */
export const compare = (self, other) => Bytes.compare(self['/'], other['/'])
