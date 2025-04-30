import * as Variable from '../variable.js'
import * as API from '../api.js'
import * as Cursor from '../cursor.js'
import * as Match from '../match.js'
import { _, $ } from '../$.js'

export class Select {
  /**
   * @param {API.SelectSyntax} source
   * @param {API.Cursor} cursor
   * @param {API.MatchFrame} parameters
   */
  constructor(source, cursor, parameters) {
    this.source = source
    this.cursor = cursor
    this.parameters = parameters
  }

  get selector() {
    return this.source.match
  }

  get recurs() {
    return null
  }

  /**
   * Base execution cost of the select operation.
   */
  get cost() {
    return 100
  }

  /**
   * @template {API.Scalar} T
   * @param {API.Term<T>|undefined} term
   * @param {API.MatchFrame} bindings
   * @returns {API.Term<T>|undefined}
   */
  resolve(term, bindings) {
    if (Variable.is(term)) {
      return Cursor.get(bindings, this.cursor, term) ?? term
    } else {
      return term
    }
  }

  /**
   * @param {API.EvaluationContext} context
   */
  *evaluate({ source, selection }) {
    const { selector } = this
    const matches = []
    for (const frame of selection) {
      const the = selector.the ? Match.resolve(frame, selector.the) : _
      const of = selector.of ? Match.resolve(frame, selector.of) : _
      const is = selector.is ? Match.resolve(frame, selector.is) : _

      // Note: We expect that there will be LRUCache wrapping the db
      // so calling scan over and over again will not actually cause new scans.
      /** @type {API.FactsSelector} */
      const query = {}
      if (!Variable.is(of)) {
        query.of = of
      }
      if (!Variable.is(the)) {
        query.the = the
      }
      if (!Variable.is(is)) {
        query.is = is
      }

      const facts = yield* source.select(query)

      for (const { the, of, is } of facts) {
        let match = Match.clone(frame)

        if (Variable.is(selector.the)) {
          let { ok } = Match.set(match, selector.the, the)
          if (ok) {
            match = ok
          } else {
            continue
          }
        }

        if (Variable.is(selector.of)) {
          let { ok } = Match.set(match, selector.of, of)
          if (ok) {
            match = ok
          } else {
            continue
          }
        }

        if (Variable.is(selector.is)) {
          let { ok } = Match.set(match, selector.is, is)
          if (ok) {
            match = ok
          } else {
            continue
          }
        }

        matches.push(match)
      }
    }
    return matches
  }

  toJSON() {
    return this.source.toJSON()
  }

  toDebugString() {
    return this.source.toDebugString()
  }
}
