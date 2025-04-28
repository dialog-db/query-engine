import * as API from './api.js'
import * as Constant from './constant.js'
import * as Link from './data/link.js'

/**
 * @param {API.DataImport} source
 * @returns {Generator<API.Fact, API.Entity>}
 */
export const derive = function* iterate(source) {
  const of = Link.of(source)
  for (const [the, is] of Object.entries(source)) {
    switch (typeof is) {
      case 'boolean':
      case 'number':
      case 'bigint':
      case 'string':
        yield /** @type {API.Fact} */ ({ the, of, is })
        break
      case 'object': {
        if (Constant.is(is)) {
          yield /** @type {API.Fact} */ ({ the, of, is })
        } else if (Array.isArray(is)) {
          let at = 0
          const array = Link.of(is)
          for (const member of is) {
            if (Constant.is(member)) {
              yield /** @type {API.Fact} */ ({
                the: `[${at}]`,
                of: array,
                is: member,
              })
              at++
            } else {
              const element = yield* iterate(member)
              yield /** @type {API.Fact} */ ({
                the: `[${at}]`,
                of: array,
                is: element,
              })
              at++
            }
          }
          yield /** @type {API.Fact} */ ({ the, of, is: array })
        } else {
          const object = yield* iterate(is)
          yield /** @type {API.Fact} */ ({ the, of, is: object })
        }
        break
      }
      default:
        throw new TypeError(`Unsupported value type: ${is}`)
    }
  }

  return of
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
