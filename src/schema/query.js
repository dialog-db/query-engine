import * as API from '../api.js'
import { rule } from '../analyzer.js'
import * as Task from '../task.js'
import * as Selector from './selector.js'
/**
 * @template Model
 * @template View
 * @implements {API.RuleApplicationView<View>}
 */
export class Query {
  /**
   * @param {object} source
   * @param {API.InferTypeTerms<Model>} [source.terms]
   * @param {API.Schema<Model, View>} source.schema
   */
  constructor({ terms, schema }) {
    const match = Selector.deriveMatch(schema.selector)

    /** @type {Record<string, API.Term>} */
    const application = { ...match }
    for (const [name, term] of Selector.iterateTerms(terms)) {
      application[name] = term
    }

    this.match =
      /** @type {API.RuleBindings<API.InferTypeVariables<Model> & API.Conclusion>} */ (
        application
      )
    this.schema = schema

    /** @type {API.Every} */
    const where =
      schema.where.length === 0 ?
        [
          {
            match: {
              of: /** @type {API.Term<API.Entity>} */ (schema.selector.this),
            },
          },
        ]
      : /** @type {API.Every} */ (schema.where)

    /** @type {API.Deduction} */
    this.rule = { match, when: where }

    this.plan = rule(this.rule)
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
    if (this.schema.where.length !== 0) {
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
