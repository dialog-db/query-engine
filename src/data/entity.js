import * as API from '../api.js'
import * as Link from './link.js'

/**
 * @type {(source: unknown) => source is API.Entity}
 */
export const is = Link.is
export const equal = Link.equal
export const toJSON = Link.toJSON
export const fromJSON = Link.fromJSON
