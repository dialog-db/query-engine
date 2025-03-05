import * as API from '../api.js'
import { Callable } from './callable.js'

/**
 * @template Model
 */
export class Schema extends Callable {
  constructor() {
    super(
      /**
       * @param {API.InferTypeTerms<Model>} selector
       */
      (selector) => this.match(selector)
    )
  }
  /**
   * @param {API.InferTypeTerms<Model>} selector
   * @returns {API.MatchView<Model>}
   */
  match(selector) {
    return []
  }

  get Schema() {
    return this
  }
}
