import * as API from './api.js'
import * as Term from './term.js'
import * as Variable from './variable.js'
import * as Constant from './constant.js'

const { Link } = Constant

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
 * @template {API.Selector} Selector
 * @param {Selector} selector
 * @param {Iterable<API.MatchFrame>} frames
 * @returns {API.InferBindings<Selector>[]}
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

/**
 * @template {API.Selector} Selector
 * @param {Selector} selector
 * @param {API.MatchFrame} bindings
 * @returns {API.InferBindings<Selector>}
 */
export const match = (selector, bindings) => {
  return Array.isArray(selector) ?
      [
        Variable.is(selector[0]) ? bindings.get(selector[0])
        : Constant.is(selector[0]) ? selector[0]
        : match(selector[0], bindings),
      ]
    : Object.fromEntries(
        Object.entries(selector).map(([key, term]) => {
          if (Variable.is(term)) {
            const value = bindings.get(term)
            return [key, value]
          } else if (Constant.is(term)) {
            return [key, term]
          } else {
            return [key, match(term, bindings)]
          }
        })
      )
}

/**
 * @template {API.Selector} Selector
 * @param {Selector} selector
 * @param {API.MatchFrame} bindings
 * @param {API.InferBindings<Selector>} base
 * @returns {API.InferBindings<Selector>|null}
 */
export const merge = (selector, bindings, base) => {
  if (Array.isArray(selector)) {
    const [term] = selector
    const extension =
      Variable.is(term) ? bindings.get(term)
      : Constant.is(term) ? term
      : match(term, bindings)
    return /** @type {API.InferBindings<Selector>} */ (
      add(/** @type {unknown[]} */ (base), extension)
    )
  } else {
    const entries = []
    for (const [key, term] of Object.entries(selector)) {
      const id = /** @type {keyof API.InferBindings<Selector>} */ (key)
      if (Term.is(term)) {
        const value = /** @type {API.Scalar|undefined} */ (
          Variable.is(term) ? bindings.get(term) : term
        )

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
