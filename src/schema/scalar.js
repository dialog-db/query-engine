import * as API from '../api.js'
import { Callable } from './callable.js'

/**
 * @template {API.The} The
 * @template {API.Scalar} [T=API.Scalar]
 */
export class Unknown extends Callable {
  constructor() {
    super(
      /** @type {API.ScalarSchema<T, The>['match']} */
      (term) => this.match(term)
    )
  }
  /**
   * @param {API.Term<T>} term
   * @returns {API.Conjunct}
   */
  match(term) {
    return /** @type {API.SystemOperator} */ ({
      match: { of: term },
      operator: 'data/type',
    })
  }
}

export const unknown = () => /** @type {API.ScalarSchema} */ (new Unknown())

/**
 * @template {API.The} The
 * @template {API.Scalar} [T=API.Scalar]
 */
export class Scalar extends Callable {
  /**
   * @param {API.TypeName} type
   * @param {The} [the]
   */
  constructor(type, the) {
    super(
      /** @type {API.ScalarSchema<T, The>['match']} */
      (term) => this.match(term)
    )
    this.the = /** @type {The} */ (the)
    this.type = type
  }
  /**
   * @param {API.Term<T>} term
   * @returns {API.Conjunct}
   */
  match(term) {
    return /** @type {API.SystemOperator} */ ({
      match: { of: term, is: this.type },
      operator: 'data/type',
    })
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

/**
 * @template {API.The} The
 * @template {API.ScalarDescriptor} Descriptor
 * @param {object} options
 * @param {Descriptor} options.type
 * @param {The} [options.the]
 * @returns {API.ScalarSchema<API.InferSchemaType<Descriptor>, The>}
 */
export const scalar = ({ type, the }) =>
  /** @type {API.ScalarSchema<API.InferSchemaType<Descriptor>, The>} */
  (new Scalar(/** @type {API.TypeName} */ (typeOf(type)), the))
