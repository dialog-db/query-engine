import * as API from './api.js'

export { rule, loop } from './analyzer.js'

/**
 * @template {API.Select} Select
 * @param {Select} selector
 */
export const Fact = (selector) => ({ match: selector, fact: {} })

export class Text {
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.this
   * @param {API.Term<string>} terms.like
   */
  static match({ this: text, like }) {
    return {
      match: { text, pattern: like },
      operator: /** @type {const} */ ('text/like'),
    }
  }
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.this
   * @param {API.Term<string>} terms.slice
   */
  static includes({ this: source, slice }) {
    return {
      match: { this: source, slice },
      operator: /** @type {const} */ ('text/includes'),
    }
  }
  /**
   * @param {object} terms
   * @param {[left:API.Term<string>, right: API.Term<string>]} terms.of
   * @param {API.Term<string>} [terms.is]
   */
  static Conact({ of: [left, right], is }) {
    return {
      match: { of: left, with: right, is },
      operator: /** @type {const} */ ('text/concat'),
    }
  }

  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.of
   * @param {API.Term<string>} [terms.is]
   */
  static Words({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('text/words'),
    }
  }
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.of
   * @param {API.Term<string>} [terms.is]
   */
  static Lines({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('text/lines'),
    }
  }
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.of
   * @param {API.Term<string>} [terms.is]
   */
  static UpperCase({ of, is }) {
    return {
      match: { of },
      operator: /** @type {const} */ ('text/upper/case'),
    }
  }
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.of
   * @param {API.Term<string>} [terms.is]
   */
  static LowerCase({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('text/lower/case'),
    }
  }
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.of
   * @param {API.Term<string>} [terms.is]
   */
  static Trim({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('text/trim'),
    }
  }
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.of
   * @param {API.Term<string>} [terms.is]
   */
  static TrimStart({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('text/trim/start'),
    }
  }
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.of
   * @param {API.Term<string>} [terms.is]
   */
  static TrimEnd({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('text/trim/end'),
    }
  }
  /**
   * @param {object} terms
   * @param {API.Term<string>} terms.of
   * @param {API.Term<number>} [terms.is]
   */
  static Length({ of, is }) {
    return {
      match: { of, is },
      operator: /** @type {const} */ ('text/length'),
    }
  }
}
