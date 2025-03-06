import { Memory } from 'datalogia'
import { assert, Fact, Text } from '../src/syntax.js'

const db = Memory.create([
  {
    word: ['pizza', 'store/*', 'store/add', '*', '[a-z]'],
  },
])

/**
 * @type {import('entail').Suite}
 */
export const testConstraints = {
  like: async (test) => {
    const Piz = assert({ word: String })
      .with({ words: Object })
      .when(({ word, words }) => [
        Fact({ the: 'word', is: words }),
        Fact({ of: words, is: word }),
        Text.match({
          this: word,
          like: 'piz*a',
        }),
      ])

    test.deepEqual(await Piz().select({ from: db }), [{ word: 'pizza' }])
  },

  'make pattern rule': async (test) => {
    const Content = assert({ word: String, match: String })
      .with({ words: Object })
      .when(({ word, words, match: like }) => [
        Fact({ the: 'word', is: words }),
        Fact({ of: words, is: word }),
        Text.match({
          this: word,
          like,
        }),
      ])

    test.deepEqual(await Content({ match: 'piz*' }).select({ from: db }), [
      { word: 'pizza', match: 'piz*' },
    ])

    test.deepEqual(await Content({ match: 'piz%' }).select({ from: db }), [])

    test.deepEqual(await Content({ match: 'Piz*' }).select({ from: db }), [])

    test.deepEqual(await Content({ match: 'piz\\*' }).select({ from: db }), [])
    test.deepEqual(await Content({ match: 'piz?a' }).select({ from: db }), [
      { word: 'pizza', match: 'piz?a' },
    ])

    test.deepEqual(await Content({ match: 'store/*' }).select({ from: db }), [
      { word: 'store/*', match: 'store/*' },
      { word: 'store/add', match: 'store/*' },
    ])

    test.deepEqual(await Content({ match: '*' }).select({ from: db }), [
      { word: 'pizza', match: '*' },
      { word: 'store/*', match: '*' },
      { word: 'store/add', match: '*' },
      { word: '*', match: '*' },
      { word: '[a-z]', match: '*' },
    ])
  },

  'test find patterns that match text': async (test) => {
    const Content = assert({ word: String })
      .with({ words: Object })
      .when(({ word, words }) => [
        Fact({ the: 'word', is: words }),
        Fact({ of: words, is: word }),
        Text.match({
          this: 'store/list',
          like: word,
        }),
      ])

    test.deepEqual(await Content().select({ from: db }), [
      { word: 'store/*' },
      { word: '*' },
    ])
  },

  'test revers pattern': async (test) => {
    const Content = assert({ word: String })
      .with({ words: Object })
      .when(({ word, words }) => [
        Fact({ the: 'word', is: words }),
        Fact({ of: words, is: word }),
        Text.match({
          this: word,
          like: '\\*',
        }),
      ])

    test.deepEqual(await Content().select({ from: db }), [{ word: '*' }])
  },
}
