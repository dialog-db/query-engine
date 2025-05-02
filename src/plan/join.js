import * as Plan from './plan.js'
import { indent } from '../data/string/format.js'
import * as JSON from '../json.js'
import { toDebugString } from '../debug.js'

export class Join {
  /**
   * @param {Plan.Conjunct[]} conjuncts - Ordered plans
   * @param {Plan.Cursor} references - Variable references
   * @param {number} cost - Total cost of the plan
   */
  constructor(conjuncts, references, cost) {
    this.conjuncts = conjuncts
    this.references = references
    this.cost = cost
  }

  /**
   * @param {Plan.EvaluationContext} context
   * @returns {Plan.Task<Plan.MatchFrame[], Plan.EvaluationError>}
   */
  *evaluate({ selection, ...context }) {
    // Execute binding steps in planned order
    for (const plan of this.conjuncts) {
      selection = yield* plan.evaluate({
        ...context,
        selection,
      })
    }

    return selection
  }

  toJSON() {
    return [...this.conjuncts.map(JSON.from)]
  }

  toDebugString() {
    const body = [...this.conjuncts.map(($) => toDebugString($))]
    return `[${indent(`\n${body.join(',\n')}`)}\n]`
  }
}
