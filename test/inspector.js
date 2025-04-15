import * as API from '../src/api.js'

class Inspector {
  /**
   * @param {API.Querier} source
   */
  constructor(source) {
    this.source = source
    /** @type {Map<API.FactsSelector, API.Result<API.Datum[], Error>>} */
    this.log = new Map()
  }
  /**
   * @param {API.FactsSelector} selector
   */
  *scan(selector) {
    try {
      const ok = yield* this.source.scan(selector)
      this.log.set(selector, { ok })
      return ok
    } catch (error) {
      this.log.set(selector, { error: /** @type {Error} */ (error) })
      throw error
    }
  }

  queries() {
    return [...this.log.keys()]
  }
}

/**
 * @param {API.Querier} source
 */
export const from = (source) => new Inspector(source)
