import * as API from './api.js'

export class Variable {
  static id = 1
  #name
  /**
   * @param {number} id
   * @param {string|symbol} name
   */
  constructor(id, name = Symbol()) {
    this['?'] = { id }
    this.#name = name
  }

  /**
   * @param {string|symbol} name
   */
  static new(name = Symbol()) {
    return new Variable(++Variable.id, name)
  }
  get id() {
    return this['?'].id
  }
  toString() {
    return typeof this.#name === 'symbol' ?
        `?@${this.#name.description ?? this.id}`
      : `?${this.#name.toString()}`
  }
  get [Symbol.toStringTag]() {
    return this.toString()
  }
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toString()
  }
}

/** @type {API.Variable} */
export const _ = new Variable(0, '_')
const $ = new Variable(1, '$')

class Scope {
  /**
   * @param {Map<string|symbol, API.Variable<any>>} [vars]
   * @returns {API.Scope}
   */
  static new(
    vars = new Map([
      ['_', _],
      ['?', $],
    ])
  ) {
    const scope = /** @type {API.Scope} */ (
      new Proxy(
        /** @type {any} */ (
          Object.assign(function () {}, {
            vars,
            toString() {
              return '?'
            },
            [Symbol.toPrimitive]() {
              return '?'
            },
            get [Symbol.toStringTag]() {
              return '?'
            },
            [Symbol.for('nodejs.util.inspect.custom')]() {
              return '?'
            },
          })
        ),
        Scope
      )
    )

    return /** @type {API.Scope} */ (scope)
  }

  /**
   * @param {{vars: Map<string|symbol, API.Variable<any>>, toString: () => string}} scope
   * @param {string|symbol} key
   */
  static get({ vars, ...target }, key) {
    if (key in target) {
      // @ts-expect-error
      return target[key]
    }
    const variable = vars.get(key)
    if (variable) {
      return variable
    } else {
      const variable = new Variable(++Variable.id, key)
      vars.set(key, variable)
      return variable
    }
  }
  /**
   * @param {{vars: Map<string|symbol, API.Variable<any>>}} scope
   * @param {string|symbol} key
   */
  static has({ vars }, key) {
    return vars.has(key)
  }

  /**
   * @param {{vars: Map<string|symbol, API.Variable<any>>}} env
   */
  static ownKeys({ vars }) {
    const keys = [...vars.keys()]
    if (!keys.includes('prototype')) {
      keys.push('prototype')
    }
    return keys
  }

  /**
   * @returns {API.Scope}
   */
  static construct() {
    return Scope.new()
  }

  /**
   @param {{vars: Map<string|symbol, API.Variable<any>>}} scope
   * @returns {API.Scope}
   */
  static apply({ vars }) {
    return Scope.new(new Map(vars))
  }
}

const global = Scope.new()
export default global

/**
 * @param {string|symbol} [name]
 */
export const variable = (name = Symbol()) => global[name]
