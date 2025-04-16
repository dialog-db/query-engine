import * as API from './api.js'
import * as Variable from './variable.js'

/** @type {API.Variable} */
export const _ = Variable._
const anonymous = Variable.create('$').with({ id: 1 })

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
      const variable = Variable.create(key)
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
