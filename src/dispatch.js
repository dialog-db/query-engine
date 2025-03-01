import * as API from './api.js'

/**
 * @template {Record<string, (input: any, context: any) => any>} [Methods={}]
 * @param {Methods} [methods]
 * @returns {API.Dispatch<Methods>}
 */
const create = (methods) => {
  const table = Object.create(null)
  for (const [key, value] of Object.entries(methods ?? {})) {
    table[key] = value
  }

  const dispatch = Object.assign(
    /**
     * @type {API.Dispatch<Methods>}
     */
    (
      /**
       * @template {keyof Methods} Case
       * @param {{[Key in Case]: {}}} input
       * @param {{}} context
       */
      function dispatch(input, context) {
        for (const choice in input) {
          if (choice in table) {
            return table[choice](input[choice], context)
          } else {
            throw new TypeError(`Dispatch table does not have ${choice} method`)
          }
        }
        throw new TypeError(`Dispatch input does not have a valid payload`)
      }
    ),
    {
      /**
       *
       * @template {Record<string, (input: unknown) => unknown>} Extension
       * @param {Extension} extension
       * @returns {API.Dispatch<Methods & Extension>}
       */
      with: (extension) => {
        for (const [key, value] of Object.entries(extension)) {
          table[key] = value
        }

        return /** @type {API.Dispatch<Methods & Extension>} */ (dispatch)
      },
    }
  )

  return dispatch
}

export { create as with }
