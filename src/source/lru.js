import * as API from '../api.js'
import * as Constant from '../constant.js'

/**
 * Generates a cache key from the selector components
 * @param {API.FactsSelector} selector
 * @returns {string}
 */
export const identify = ({ entity, attribute, value }) =>
  JSON.stringify({
    the: attribute === undefined ? undefined : Constant.toString(attribute),
    of: entity === undefined ? undefined : Constant.toString(entity),
    value: value === undefined ? undefined : Constant.toString(value),
  })

/**
 * @param {API.Querier} source - The underlying data source
 * @param {object} options
 * @param {number} [options.capacity] - Maximum number of individual facts to store in cache
 */
export const create = (source, { capacity = 10_000 } = {}) =>
  new LRUCache(source, capacity)

/**
 * Implements a Least Recently Used (LRU) cache for facts with a capacity limit
 * based on the total number of individual facts cached.
 */
class LRUCache {
  #size
  /**
   * @param {API.Querier} source - The underlying data source
   * @param {number} capacity - Maximum number of individual facts to store in cache
   */
  constructor(source, capacity) {
    this.source = source
    this.capacity = capacity
    /** @type {Map<string, API.Datum[]>} */
    this.cache = new Map()
    /** @type {number} */
    this.#size = 0
  }

  /**
   * Updates the LRU order by removing and re-adding the key
   * @param {string} key
   */
  touch(key) {
    const value = this.cache.get(key)
    if (value) {
      this.cache.delete(key)
      this.cache.set(key, value)
    }
  }

  /**
   * Evicts entries until cache is under capacity
   */
  evict() {
    for (const [key, facts] of this.cache) {
      if (this.#size <= this.capacity) {
        break
      }
      this.#size -= facts.length
      this.cache.delete(key)
    }
  }

  /**
   * @param {API.FactsSelector} selector
   */
  *scan(selector) {
    const key = identify(selector)

    // Check if we have it in cache
    const cached = this.cache.get(key)
    if (cached) {
      this.touch(key)
      return cached
    }

    // Fetch from source
    const facts = yield* this.source.scan(selector)

    // Skip caching if the result set is larger than our total capacity
    if (facts.length > this.capacity) {
      return facts
    }

    // Add to cache
    this.cache.set(key, facts)
    this.#size += facts.length

    // Evict if we're over capacity
    if (this.#size > this.capacity) {
      this.evict()
    }

    return facts
  }

  /**
   * Clears the cache
   */
  clear() {
    this.cache.clear()
    this.#size = 0
  }

  /**
   * Returns current number of cached facts
   */
  size() {
    return this.#size
  }

  /**
   * Returns the number of cached queries
   */
  get count() {
    return this.cache.size
  }
}
