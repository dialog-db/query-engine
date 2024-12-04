import * as API from './api.js'
import * as Link from './link.js'

/**
 * @type {(source: unknown) => source is API.Entity}
 */
export const is = Link.is
