import * as API from './api.js'
import * as Variable from './variable.js'

/**
 * @returns {{}}
 */
export const create = () => ({})

/**
 * @param {API.Bindings} bindings
 * @param {API.Variable} variable
 * @param {API.Term} value
 * @returns {API.Bindings}
 */
export const set = (bindings, variable, value) => ({
  ...bindings,
  [Variable.toKey(variable)]: value,
})

/**
 * @param {API.Bindings} bindings
 * @param {API.Variable} variable
 * @param {API.Term} value
 */
export const assign = (bindings, variable, value) => {
  bindings[Variable.toKey(variable)] = value
}

/**
 * @template {API.Bindings} Bindings
 * @template {API.Scalar} T
 * @param {Bindings} bindings
 * @param {API.Term<T>} term
 * @returns {API.Term<T>|undefined}
 */
export const get = (bindings, term) => {
  if (Variable.is(term)) {
    const key = Variable.toKey(term)
    return /** @type {API.Term<T>|undefined}| */ (bindings[key])
  } else {
    return term
  }
  // If the term is a constant we simply return the term

  // PomoDB also seems to handle CID and aggregator terms differently. As far
  // as I can understand it simply uses separate key space in the map for them.
  // we may have to adopt some of that here as well.
}

/**
 * Attempts to resolve given patter from the given bindings. Either returns
 * the resolved pattern if any of the variables are in the bindings or
 * returns the original pattern.
 *
 * @param {API.Bindings} bindings
 * @param {API.Pattern} pattern
 * @returns {API.Pattern}
 */
export const resolve = (bindings, pattern) => {
  const [entity, attribute, value] = pattern
  const resolved = []
  if (Variable.is(entity)) {
    resolved.push(get(bindings, entity) ?? entity)
  } else {
    resolved.push(entity)
  }

  if (Variable.is(attribute)) {
    resolved.push(get(bindings, attribute) ?? attribute)
  } else {
    resolved.push(attribute)
  }

  if (Variable.is(value)) {
    resolved.push(get(bindings, value) ?? value)
  } else {
    resolved.push(value)
  }

  if (
    resolved[0] !== entity ||
    resolved[1] !== attribute ||
    resolved[2] !== value
  ) {
    return /** @type {API.Pattern & any} */ (resolved)
  } else {
    return pattern
  }
}
