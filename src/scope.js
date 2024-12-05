import * as API from './api.js'

class Variable {
  #name
  /**
   * @param {number} id
   * @param {string|symbol} name
   */
  constructor(id, name = Symbol()) {
    this['?'] = { id }
    this.#name = name
  }
  get id() {
    return this['?'].id
  }
  toString() {
    return typeof this.#name === 'symbol'
      ? `?@${this.#name.description ?? this.id}`
      : `?${this.#name.toString()}`
  }
  get [Symbol.toStringTag]() {
    return this.toString()
  }
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toString()
  }
}

class Scope {
  /**
   * @param {Map<string|symbol, API.Variable<any>>} [vars]
   * @returns {API.Scope & API.Variable}
   */
  static new(vars = new Map([['_', new Variable(0, '_')]])) {
    const scope = /** @type {API.Scope} */ (
      new Proxy(
        /** @type {any} */ (Object.assign(function () {}, { vars })),
        Scope
      )
    )

    return /** @type {API.Scope & API.Variable} */ (scope)
  }

  /**
   * @param {{vars: Map<string|symbol, API.Variable<any>>}} scope
   * @param {string|symbol} key
   */
  static get({ vars }, key) {
    const variable = vars.get(key)
    if (variable) {
      return variable
    } else {
      const variable = new Variable(vars.size + 1, key)
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
