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
   * @template {API.Scalar} T
   * @param {{name?: string} & API.Variable<T>} origin
   * @returns {API.Variable<T>}
   */
  static fork({ name }) {
    return new Variable(++Variable.id, name)
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
  get name() {
    return this.#name
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
const anonymous = new Variable(1, '$')

class Variables {
  /**
   * @param {Map<string|symbol, API.Variable<any>>} [vars]
   * @returns {API.$}
   */
  static new(
    vars = new Map([
      ['_', _],
      ['?', anonymous],
    ])
  ) {
    const scope = /** @type {API.$} */ (
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
        Variables
      )
    )

    return /** @type {API.$} */ (scope)
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
   * @returns {API.$}
   */
  static construct() {
    return Variables.new()
  }

  /**
   @param {{vars: Map<string|symbol, API.Variable<any>>}} scope
   * @returns {API.$}
   */
  static apply({ vars }) {
    return Variables.new(new Map(vars))
  }
}

export const $ = Variables.new()
export default $

/**
 * @param {string|symbol} [name]
 */
export const variable = (name = Symbol()) => global[name]
