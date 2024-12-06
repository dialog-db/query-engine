import * as API from './api.js'
import * as Term from './term.js'
import * as Constant from './constant.js'

/**
 * Unifies variables in actual row with variables in expected row. The
 *
 * @param {API.Row} actual
 * @param {API.Row} expected
 * @param {API.Bindings} bindings
 * @returns {API.Result<API.Bindings, Error>}
 */
export const unify = (actual, expected, bindings) => {
  for (const [at, variable] of Object.entries(expected)) {
    const result = Term.unify(actual[at], variable, bindings)
    if (result.error) {
      return result
    }
    bindings = result.ok
  }

  return { ok: bindings }
}

/**
 * @param {API.Row} row
 */
export const toJSON = (row) =>
  Object.fromEntries(
    Object.entries(row).map(([id, term]) => [
      id,
      Term.is(term) ? Term.toJSON(term) : Constant.toJSON(term),
    ])
  )
