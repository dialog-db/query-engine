/**
 * @param {string} message
 */
export const indent = (message, indent = '  ') =>
  `${message.split('\n').join(`\n${indent}`)}`

/**
 * @param {string} message
 */
export const li = (message) => indent(`- ${message}`)
