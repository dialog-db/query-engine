import * as API from './api.js'
import * as Variable from './variable.js'
import * as Constant from './constant.js'
import { Var } from './lib.js'

const { _ } = Variable

/**
 * @typedef {Top|Nested} Scope
 */

/**
 * Represents a local variable references to a remote variables. This is n:1
 * relation meaning multiple local variables may point to the same remote one
 * but local variable can point to at most one remote variable.
 *
 * @typedef {Map<API.Variable, API.Variable>} References
 */

class Top {
  /**
   * @param {State} [state]
   */
  constructor(state = new Map()) {
    this.state = state
  }

  /**
   * @param {API.Term} variable
   * @param {API.Scalar} value
   */
  set(variable, value) {
    throw new RangeError('Top scope can not be modified')
  }
  /**
   * @param {API.Variable} variable
   * @returns {API.Scalar|undefined}
   */
  get(variable) {
    return undefined
  }
  nest() {
    return new Nested(new Map(), new Map(), this)
  }
}

/**
 * Represents set of bound variables.
 * @typedef {Map<API.Variable, API.Scalar>} State
 */

class Nested {
  /**
   * @param {State} [state]
   * @param {References} [references]
   * @param {Nested|Top} [parent]
   */
  constructor(state = new Map(), references = new Map(), parent = top) {
    this.references = references
    this.state = state
    this.parent = parent
  }

  nest() {
    return new Nested(new Map(), new Map(), this)
  }

  /**
   *
   * @param {API.Variable} local
   * @param {API.Variable} parent
   */
  associate(local, parent) {
    const reference = this.references.get(local)
    if (reference && reference !== parent) {
      throw new RangeError(
        `Variable ${Variable.toDebugString(
          local
        )} is already associated with ${Variable.toDebugString(reference)}`
      )
    } else {
      this.references.set(local, parent)
    }

    return this
  }

  /**
   * @param {API.Term} variable
   * @param {API.Scalar} value
   */
  set(variable, value) {
    const { state, references, parent } = this
    // If it is not a variable or is `_` we simply discard value (_ is special
    // as it unifies with anything).
    if (Variable.is(variable) && variable !== _) {
      // Otherwise we need to determine whether variable is a reference to a
      // cell in the parent scope or if it is a local variable.
      const reference = references.get(variable)
      if (reference) {
        parent.set(reference, value)
      } else {
        const current = state.get(variable)
        if (current === undefined) {
          state.set(variable, value)
        } else if (!Constant.equal(current, value)) {
          throw new RangeError(
            `Variable ${Variable.toDebugString(
              variable
            )} is set to ${Constant.toDebugString(
              current
            )} and can not be unified with ${Constant.toDebugString(value)}`
          )
        }
      }
    }
    return this
  }

  /**
   * @param {API.Variable} variable
   * @returns {API.Scalar|undefined}
   */
  get(variable) {
    const reference = this.references.get(variable)
    return reference ? this.parent.get(reference) : this.state.get(variable)
  }
}

export const top = new Top()

/**
 * @param {State} [state]
 * @param {References} [references]
 */
export const scope = (state, references) => new Nested(state, references)
