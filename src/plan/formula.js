import * as API from '../api.js'
import * as Cursor from '../cursor.js'
import * as Term from '../term.js'
import * as Constant from '../constant.js'
import * as Match from '../match.js'
import operators from '../formula/lib.js'
import * as Terms from '../terms.js'

export class FormulaApplication {
  /**
   * @param {API.SystemOperator} source
   * @param {Map<API.Variable, number>} cells
   * @param {Record<string, API.Term>|API.Term} from
   * @param {Record<string, API.Term>} to
   * @param {API.Cursor} cursor
   * @param {API.MatchFrame} parameters
   */
  constructor(source, cells, from, to, cursor, parameters) {
    this.cells = cells
    this.source = source
    this.from = from
    this.to = to
    this.cursor = cursor
    this.parameters = parameters
  }

  get recurs() {
    return null
  }

  // /**
  //  * Base execution cost of the formula application operation.
  //  */
  // get cost() {
  //   return 5
  // }

  /**
   * @template {API.Terms} Terms
   * @param {Terms} terms
   * @param {API.MatchFrame} bindings
   * @returns {API.InferTerms<Terms>}
   */
  resolve(terms, bindings) {
    return /** @type {API.InferTerms<Terms>} */ (
      Term.is(terms) ? Cursor.get(bindings, this.cursor, terms)
      : Array.isArray(terms) ?
        terms.map((term) => Cursor.get(bindings, this.cursor, term))
      : Object.fromEntries(
          Object.entries(terms).map(([key, term]) => [
            key,
            Cursor.get(bindings, this.cursor, term),
          ])
        )
    )
  }

  /**
   * @param {API.EvaluationContext} context
   */
  *evaluate({ selection }) {
    const { source } = this
    const operator =
      /** @type {(input: API.Operand) => Iterable<API.Operand>} */
      (source.formula ?? operators[source.operator])

    const matches = []
    for (const frame of selection) {
      for (const output of operator(this.read(frame))) {
        // If function returns single output we treat it as { is: output }
        // because is will be a cell in the formula application.
        const extension = Constant.is(output) ? { is: output } : output
        const frames = this.write(
          frame,
          /** @type {Record<string, API.Scalar>} */ (extension)
        )
        matches.push(...frames)
      }
    }

    return matches
  }

  /**
   * @template {API.Terms} Terms
   * @param {API.MatchFrame} frame
   * @returns {API.InferTerms<Terms>}
   */
  read(frame) {
    const { from } = this
    const result =
      Term.is(from) ?
        Constant.expect(Match.get(frame, from), 'Formula input was not present')
      : Object.fromEntries(
          Object.entries(from).map(([key, term]) => [
            key,
            Constant.expect(
              Match.get(frame, term),
              'Formula input was not present'
            ),
          ])
        )

    return /** @type {API.InferTerms<Terms>} */ (result)
  }

  /**
   * @param {API.MatchFrame} frame
   * @param {Record<string, API.Scalar>} extension
   */
  write(frame, extension) {
    const terms = Object.entries(this.to)
    if (terms.length === 0) {
      return [frame]
    } else {
      let match = Match.clone(frame)
      for (const [key, term] of terms) {
        const { ok } = Match.unify(match, term, extension[key])
        if (ok) {
          match = ok
        } else {
          return []
        }
      }
      return [match]
    }
  }

  toJSON() {
    return {
      match: this.source.match,
      operator: this.source.operator,
    }
  }

  toDebugString() {
    const { match, operator } = this.source

    return `{ match: ${Terms.toDebugString(match)}, operator: "${operator}" }`
  }
}
