import * as API from './api.js'
import * as Variable from './variable.js'
import * as Entity from './entity.js'

/**
 *
 * @param {API.Pattern} source
 */
export function* variables([entity, attribute, value]) {
  if (Variable.is(entity)) {
    yield entity
  }
  if (Variable.is(attribute)) {
    yield attribute
  }
  if (Variable.is(value)) {
    yield value
  }
}

/**
 * Analyzes a Case clause pattern to determine variable dependencies and bindings
 *
 * @param {API.Pattern} source
 * @returns {API.Analysis}
 */
export const analyze = (source) => {
  const dependencies = new Set()
  const binds = new Set()

  // Any variable used is both a potential dependency and binding
  for (const term of variables(source)) {
    const id = Variable.id(term)
    binds.add(id)
    dependencies.add(id)
  }

  const [entity, attribute, value] = source
  // Base cost for having no bound terms
  // Significant reduction for each bound term since lookups are efficient
  let cost = 1000 / Math.pow(10, binds.size)

  // Additional cost adjustment based on expected selectivity
  if (!Variable.is(entity)) {
    cost *= 0.7 // Entity lookups highly selective
  }
  if (!Variable.is(attribute)) {
    cost *= 0.8 // Attribute lookups moderately selective
  }
  if (!Variable.is(value)) {
    // Entity value lookups are as selective as entity lookups
    // Non-entity values are least selective
    cost *= Entity.is(value) ? 0.7 : 0.9
  }

  return { dependencies, binds, cost }
}
