import * as API from './api.js'

class Join {
  /**
   * @param {Set<API.Variable>} cells
   */
  constructor(cells = new Set()) {
    this.cells = cells
  }
  /**
   * @param {API.Variable} cell
   */
  add(cell) {
    this.cells.add(cell)
  }

  /**
   * @param {Map<API.Variable, API.Scalar>} frame
   * @returns {API.Scalar|undefined}
   */
  read(frame) {
    for (const cell of this.cells) {
      const value = frame.get(cell)
      if (value !== undefined) {
        return value
      }
    }
    return undefined
  }

  /**
   * @param {Map<API.Variable, API.Scalar>} frame
   * @param {API.Scalar} value
   */
  write(frame, value) {
    for (const cell of this.cells) {
      frame.set(cell, value)
    }
  }
}
