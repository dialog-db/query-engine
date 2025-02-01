import * as API from '../api.js'
import { rule } from '../analyzer.js'
import * as Task from '../task.js'

/**
 * @template Model
 * @template View
 * @implements {API.MatchRule}
 * @implements {API.RuleApplicationView<View>}
 */
export class Query {
  /**
   * @param {object} source
   * @param {API.InferTypeTerms<Model>} source.match
   * @param {API.Schema<Model, View>} source.schema
   */
  constructor(source) {
    this.match =
      /** @type {API.RuleBindings<API.InferTypeVariables<Model> & API.Conclusion>} */ (
        source.match
      )
    this.schema = source.schema
    // @ts-expect-error TODO fix this
    this.rule = source.schema.rule

    this.plan = rule({
      match: this.rule.match,
      when:
        this.rule.when?.length === 0 ?
          [
            {
              match: {
                of: /** @type {API.Term<API.Entity>} */ (this.rule.match.this),
              },
            },
          ]
        : this.rule.when,
    })
      .apply(/** @type {{}} */ (this.match))
      .plan()
  }

  toSource() {
    return this.plan.toDebugString()
  }

  /**
   * @param {{ from: API.Querier }} source
   */
  select(source) {
    return Task.perform(this.query(source))
  }

  *[Symbol.iterator]() {
    if (this.rule.when?.length !== 0) {
      yield {
        match: this.match,
        rule: this.rule,
      }
    }
  }

  /**
   * @param {{ from: API.Querier }} terms
   */
  *query({ from }) {
    const selection = yield* this.plan.evaluate({
      source: from,
      selection: [new Map()],
    })

    const results = []
    for (const match of selection) {
      results.push(this.schema.view(match, this.schema.selector))
    }

    return results
  }
}
