import * as Data from './data.js'
import * as Text from './text.js'
import * as Math from './math.js'
import * as UTF8 from './utf8.js'

export default {
  '==': Data.is,
  '>': Data.greater,
  '<': Data.less,
  '>=': Data.greaterOrEqual,
  '<=': Data.lessOrEqual,
  'data/type': Data.type,
  'data/refer': Data.refer,
  'text/like': Text.like,
  'text/concat': Text.concat,
  'text/words': Text.words,
  'text/lines': Text.lines,
  'text/case/upper': Text.toUpperCase,
  'text/case/lower': Text.toLowerCase,
  'text/trim': Text.trim,
  'text/trim/start': Text.trimStart,
  'text/trim/end': Text.trimEnd,
  'text/includes': Text.includes,
  'text/slice': Text.slice,
  'text/length': Text.length,
  'text/to/utf8': UTF8.toUTF8,
  'utf8/to/text': UTF8.fromUTF8,
  '+': Math.addition,
  '-': Math.subtraction,
  '*': Math.multiplication,
  '/': Math.division,
  '%': Math.modulo,
  '**': Math.power,
  'math/absolute': Math.absolute,
}
