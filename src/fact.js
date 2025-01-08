import * as API from './api.js'
import * as Constant from './constant.js'
import * as Link from './link.js'

/**
 * @param {API.Instantiation} source
 * @returns {Generator<API.Fact, API.Entity>}
 */
export const derive = function* iterate(source) {
  const entity = Link.of(source)
  for (const [key, value] of Object.entries(source)) {
    switch (typeof value) {
      case 'boolean':
      case 'number':
      case 'bigint':
      case 'string':
        yield [entity, key, value]
        break
      case 'object': {
        if (Constant.is(value)) {
          yield [entity, key, value]
        } else if (Array.isArray(value)) {
          let at = 0
          const array = Link.of(value)
          for (const member of value) {
            if (Constant.is(member)) {
              yield [array, `[${at}]`, member]
              at++
            } else {
              const element = yield* iterate(member)
              yield [array, `[${at}]`, element]
              at++
            }
          }
          yield [entity, key, array]
        } else {
          const object = yield* iterate(value)
          yield [entity, key, object]
        }
        break
      }
      default:
        throw new TypeError(`Unsupported value type: ${value}`)
    }
  }

  return entity
}

/**
 * @param {[API.Entity, API.Attribute, API.Scalar, cause?: API.Link[]]} source
 */
export const create = ([entity, attribute, value, cause = []]) =>
  new Fact(entity, attribute, value, sort(cause))

/**
 *
 * @param {API.Link[]} links
 */
const sort = (links) =>
  links.sort((left, right) => left.toString().localeCompare(right.toString()))

/**
 * @param {[API.Entity, API.Attribute, API.Scalar, cause?: API.Link[]]} source
 */
export const link = ([entity, attribute, value, cause = []]) =>
  Link.of([entity, attribute, value, sort(cause)])

class Fact extends Array {
  get entity() {
    return this[0]
  }
  get attribute() {
    return this[1]
  }
  get value() {
    return this[2]
  }
  get cause() {
    return this[3]
  }
  get link() {
    if (!this._link) {
      this._link = link(/** @type {any} */ (this))
    }
    return this._link
  }
}
