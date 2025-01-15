import * as API from './api.js'
import * as Term from './term.js'
import * as Variable from './variable.js'
import * as Constant from './constant.js'
import * as Bindings from './bindings.js'

const { Link } = Constant

/**
 * @template {API.Selector} Selector
 * @param {Selector} selector
 * @param {API.Bindings} bindings
 * @param {API.InferBindings<Selector>} base
 * @returns {API.InferBindings<Selector>|null}
 */
export const merge = (selector, bindings, base) => {
  if (Array.isArray(selector)) {
    const [term] = selector
    const extension =
      Term.is(term) ? Bindings.get(bindings, term) : match(term, bindings)
    return /** @type {API.InferBindings<Selector>} */ (
      add(/** @type {unknown[]} */ (base), extension)
    )
  } else {
    const entries = []
    for (const [key, term] of Object.entries(selector)) {
      const id = /** @type {keyof API.InferBindings<Selector>} */ (key)
      if (Term.is(term)) {
        const value = /** @type {API.Scalar} */ (Bindings.get(bindings, term))
        if (value === undefined) {
          return null
        } else {
          if (Constant.equal(/** @type {API.Scalar} */ (base[id]), value)) {
            entries.push([key, value])
          } else {
            return null
          }
        }
      } else {
        const value = merge(term, bindings, /** @type {any} */ (base[id]))
        if (value === null) {
          return null
        } else {
          entries.push([key, value])
        }
      }
    }
    return Object.fromEntries(entries)
  }
}

/**
 * @template {API.Selector} Selector
 * @param {Selector} selector
 * @param {API.Bindings} bindings
 * @returns {API.InferBindings<Selector>}
 */
export const match = (selector, bindings) =>
  Array.isArray(selector) ?
    [
      Term.is(selector[0]) ?
        Bindings.get(bindings, selector[0])
      : match(selector[0], bindings),
    ]
  : Object.fromEntries(
      Object.entries(selector).map(([key, term]) => {
        if (Term.is(term)) {
          const value = Bindings.get(bindings, term)
          return [key, value]
        } else {
          return [key, match(term, bindings)]
        }
      })
    )

/**
 * @template {API.Selector} Selector
 * @param {Selector} selector
 * @param {Iterable<API.Bindings>} frames
 */
export const select = (selector, frames) => {
  /** @type {API.InferBindings<Selector>[]} */
  const selection = []
  for (const frame of frames) {
    if (selection.length === 0) {
      selection.push(match(selector, frame))
    } else {
      let joined = false
      for (const [offset, match] of selection.entries()) {
        const merged = merge(selector, frame, match)
        if (merged) {
          selection[offset] = merged
          joined = true
        }
      }

      if (!joined) {
        selection.push(match(selector, frame))
      }
    }
  }

  return selection
}

/** @type {WeakMap<unknown[], Set<string>>} */
const GROUP_MEMBERS = new WeakMap()

/**
 * @template T
 * @param {T[]} group
 * @returns {Set<string>}
 */
const membersOf = (group) => {
  const members = GROUP_MEMBERS.get(group)
  if (!members) {
    const members = new Set()
    for (const member of group) {
      if (member !== undefined) {
        const key = Link.of(member).toString()
        if (!members.has(key)) {
          members.add(key)
        }
      }
    }
    GROUP_MEMBERS.set(group, members)
    return members
  } else {
    return members
  }
}

/**
 * @template T
 * @param {T[]} group
 * @param {T} member
 */
export const add = (group, member) => {
  const members = membersOf(group)
  if (member !== undefined) {
    const key = Link.of(member).toString()
    if (!members.has(key)) {
      members.add(key)
      group.push(member)
    }
  }
  return group
}

/**
 * @template {API.Selector} Selector
 * @param {Selector} selector
 * @param {API.Bindings} bindings
 * @param {string[]} path
 * @returns {API.Result<API.InferBindings<Selector>, Error>}
 */
export const trySelect = (selector, bindings, path = []) => {
  const entries = []
  for (const [key, term] of Object.entries(selector)) {
    if (Term.is(term)) {
      const value = Bindings.get(bindings, term)
      if (value === null) {
        return {
          error: new RangeError(
            `Unbound variable at ${[...path, key].join('.')}`
          ),
        }
      } else {
        entries.push([key, value])
      }
    } else {
      const result = trySelect(term, bindings, [...path, key])
      if (result.error) {
        return result
      } else {
        entries.push([key, result.ok])
      }
    }
  }
  return { ok: Object.fromEntries(entries) }
}

/**
 * @param {API.Selector} selector
 * @returns {Iterable<API.Variable>}
 */
export const variables = function* (selector) {
  for (const term of Object.values(selector)) {
    if (Variable.is(term)) {
      yield term
    } else if (!Constant.is(term)) {
      yield* variables(term)
    }
  }
}

/**
 * @param {API.Selector} selector
 * @returns {Iterable<[string[], API.Term]>}
 */
export const entries = (selector) => entriesIn([], selector)

/**
 * @param {string[]} path
 * @param {API.Selector} selector
 * @returns {Iterable<[string[], API.Term]>}
 */
const entriesIn = function* (path, selector) {
  for (const [key, term] of Object.entries(selector)) {
    if (Variable.is(term) || Constant.is(term)) {
      yield [[...path, key], term]
    } else {
      yield* entriesIn([...path, key], term)
    }
  }
}

/**
 *
 * @param {API.Selector} selector
 * @param {string[]} path
 * @returns {API.Term}
 */
export const at = (selector, path) => {
  /** @type {any} */
  let object = selector
  for (const key of path) {
    object = object[key]
    if (object == null) {
      break
    }
  }
  return object
}

/**
 * @param {API.Selector} selector
 * @returns {API.Selector}
 */
export const toJSON = (selector) =>
  Object.fromEntries(
    Object.entries(selector).map(([id, term]) => [
      id,
      Term.is(term) ? Term.toJSON(term) : toJSON(term),
    ])
  )

/**
 * @param {API.Selector} variables
 * @returns {string}
 */
export const toString = (variables) => {
  const parts = []
  for (const [id, term] of Object.entries(variables)) {
    parts.push(`${id}:${Term.is(term) ? Term.toString(term) : toString(term)}`)
  }

  return `{${parts.join(', ')}}`
}
