// @ts-nocheck

/**
 * @template {(...args: any[]) => any} F
 */
export class Callable extends Function {
  /**
   * @param {F} invoke
   */
  constructor(invoke) {
    return Object.setPrototypeOf(invoke, new.target.prototype)
  }
}
