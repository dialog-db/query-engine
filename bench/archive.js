import { refer, fromString, fromBytes } from 'https://esm.sh/merkle-reference'
import { Memory, API } from '../src/lib.js'
import { base32 } from 'https://esm.sh/multiformats/bases/base32'

export const importValue = (value) => {
  if (value['/']) {
    const bytes = base32.decode(value['/'])
    return fromBytes(bytes.subarray(1))
  } else {
    return value
  }
}

/**
 *
 * @param {{json: URL}} address
 */
export const open = async ({ json: url }) => {
  const response = await fetch(url)
  const json = await response.json()

  /** @type {API.Fact[]} */
  const facts = []

  for (const [id, group] of Object.entries(json)) {
    const entity = fromString(id)
    for (const [namespace, attributes] of Object.entries(group)) {
      for (const [name, content] of Object.entries(attributes)) {
        for (const value of Array.isArray(content) ? content : [content]) {
          facts.push([entity, `${namespace}/${name}`, importValue(value)])
        }
      }
    }
  }

  return Memory.create(facts)
}
