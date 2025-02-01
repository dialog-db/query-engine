import * as API from '../api.js'
import { Schema } from './schema.js'
import $ from '../$.js'

/**
 * @template T
 * @template U
 * @param {API.Schema<T>} schema
 * @param {U} defaultValue
 */
export const implicit = (schema, defaultValue) => {}

/**
 * @template T, U
 * @extends {Schema<API.InferTypeTerms<T|U>>}
 * @implements {API.ImplicitSchema<T, U>}
 */
class ImplicitSchema extends Schema {
  /**
   * @param {API.Schema<T>} schema
   * @param {U} defaultValue
   */
  constructor(schema, defaultValue) {
    super()
    this.schema = schema
    this.defaultValue = defaultValue
  }
  get selector() {
    return this.schema.selector
  }

  /**
   * @param {API.InferTypeTerms<T|U>} selector
   * @returns {API.MatchView<T|U>}
   */
  match(selector) {
    return [
      {
        match: {},
        rule: Implicit,
      },
    ]
  }
}

const Implicit = /** @type {API.Deduction} */ ({
  match: { the: $.the, of: $.of, is: $.is, implicit: $.implicit },
  when: {
    Explicit: [{ match: { the: $.the, of: $.of, is: $.is } }],
    Implicit: [
      { not: { match: { the: $.the, of: $.of } } },
      { match: { of: $.implicit, is: $.is }, operator: '==' },
    ],
  },
})
