/**
 * @param {Iterable<unknown>} iterable
 */
export const isEmpty = (iterable) => {
  for (const _ of iterable) {
    return false
  }
  return true
}
