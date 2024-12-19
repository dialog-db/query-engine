import { base64 } from 'multiformats/bases/base64'

/**
 * @param {unknown} bytes
 * @returns {bytes is Uint8Array}
 */
export const is = (bytes) => bytes instanceof Uint8Array

/**
 * @param {Uint8Array} self
 * @param {Uint8Array} other
 * @returns {boolean}
 */
export const equal = (self, other) => {
  let length = self.byteLength
  if (length === other.byteLength) {
    // If both expected and actual have `byteLength` property we assume they are
    // Uint8Array's and proceed with byte by byte comparison. This assumption may
    // be incorrect if at runtime type requirements are not upheld, but we don't
    // we do not support that use case.
    const source = self
    const target = other
    let offset = 0
    while (offset < length) {
      if (source[offset] !== target[offset]) {
        return false
      }
      offset++
    }
    return true
  } else {
    return false
  }
}

/**
 * @typedef {{'/': {bytes: string}}} JSON
 * @param {Uint8Array} bytes
 * @returns {JSON}
 */
export const toJSON = (bytes) => ({ '/': { bytes: base64.baseEncode(bytes) } })

/**
 * @param {JSON} json
 * @returns {Uint8Array}
 */
export const fromJSON = (json) => base64.baseDecode(json['/'].bytes)

/**
 * @param {Uint8Array} bytes
 */
export const toString = (bytes) => `{"/":{bytes:"${base64.baseEncode(bytes)}"}}`

/**
 * @param {Uint8Array} self
 * @param {Uint8Array} other
 * @returns {0|-1|1}
 */
export const compare = (self, other) => {
  const count = Math.min(self.length, other.length)
  let offset = 0
  while (offset < count) {
    const delta = self[offset] - other[offset]
    if (delta < 0) {
      return -1
    } else if (delta > 0) {
      return 1
    } else {
      offset++
    }
  }

  const delta = self.length - other.length
  return (
    delta < 0 ? -1
    : delta > 0 ? 1
    : 0
  )
}
