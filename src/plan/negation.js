import * as Plan from './plan.js'
import * as JSON from '../json.js'
import { toDebugString } from '../debug.js'

export class Negation {
  /**
   * @param {Plan.Constraint} operand
   */
  constructor(operand) {
    this.operand = operand
  }

  /**
   * @param {Plan.EvaluationContext} context
   */
  *evaluate({ selection, ...context }) {
    const matches = []
    for (const frame of selection) {
      const excluded = yield* this.operand.evaluate({
        ...context,
        selection: [frame],
      })

      if (excluded.length === 0) {
        matches.push(frame)
      }
    }

    return matches
  }

  toJSON() {
    return { not: JSON.from(this.operand) }
  }

  toDebugString() {
    return `{ not: ${toDebugString(this.operand)} }`
  }
}
