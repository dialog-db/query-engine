const ANY_CHAR = '[\\s\\S]'
export const GLOB = { ignoreCase: false, single: '?', arbitrary: '*' }
export const LIKE = { ignoreCase: true, single: '_', arbitrary: '%' }

/**
 *
 * @param {string} source
 * @param {object} options
 * @param {boolean} options.ignoreCase
 * @param {string} options.single
 * @param {string} options.arbitrary
 *
 * @returns
 */
export const compile = (source, { ignoreCase, single, arbitrary }) => {
  const flags = ignoreCase ? 'i' : ''
  let pattern = ''
  let escaping = false
  for (const char of source) {
    switch (char) {
      case single: {
        pattern = escaping ? `${pattern}${char}` : `${pattern}${ANY_CHAR}`
        escaping = false
        break
      }
      case arbitrary: {
        pattern = escaping ? `${pattern}${char}` : `${pattern}${ANY_CHAR}*`
        escaping = false
        break
      }
      case '\\': {
        pattern = `${pattern}${char}`
        escaping = !escaping
        break
      }
      case '/':
      case '*':
      case '$':
      case '^':
      case '+':
      case '.':
      case ',':
      case '(':
      case ')':
      case '<':
      case '=':
      case '!':
      case '[':
      case ']':
      case '}':
      case '{':
      case '|': {
        pattern = escaping ? `${pattern}${char}` : `${pattern}\\${char}`
        escaping = false
        break
      }
      default:
        pattern = `${pattern}${char}`
        break
    }
  }

  return new RegExp(`^${pattern}$`, flags)
}
