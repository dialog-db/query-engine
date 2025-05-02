/**
 * @param {unknown} source
 */
export const from = (source) =>
  // @ts-expect-error
  typeof source.toJSON === 'function' ? source.toJSON() : source

export const stringify = /** @type {typeof JSON.stringify} */ (
  (source, replacer, indent) =>
    JSON.stringify(from(source), /** @type {any} */ (replacer), indent)
)

/**
 * @param {unknown} source
 */
export const toString = (source) => stringify(source, null, 2)

/**
 * @param {string} source
 */
export const fromString = (source) => JSON.parse(source)

export { fromString as parse }
