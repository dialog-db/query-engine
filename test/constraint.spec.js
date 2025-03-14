import { Memory, $ } from 'datalogia'
import { deduce, Fact, Text } from '../src/syntax.js'

const db = Memory.create([
  {
    word: ['pizza', 'store/*', 'store/add', '*', '[a-z]'],
  },
])

/**
 * @type {import('entail').Suite}
 */
export const testConstraints = {
  like: async (assert) => {
    const Piz = deduce({ word: String })
      .with({ words: Object })
      .when(({ word, words }) => [
        Fact({ the: 'word', is: words }),
        Fact({ of: words, is: word }),
        Text.match({
          this: word,
          pattern: 'piz*a',
        }),
      ])

    assert.deepEqual(await Piz().select({ from: db }), [{ word: 'pizza' }])
  },

  'make pattern rule': async (assert) => {
    const Content = deduce({ word: String, match: String })
      .with({ words: Object })
      .when(({ word, words, match: like }) => [
        Fact({ the: 'word', is: words }),
        Fact({ of: words, is: word }),
        Text.match({
          this: word,
          pattern: like,
        }),
      ])

    assert.deepEqual(
      await Content({ match: 'piz*', word: $ }).select({ from: db }),
      [{ word: 'pizza', match: 'piz*' }]
    )

    assert.deepEqual(
      await Content.match({ match: 'piz%' }).select({ from: db }),
      []
    )

    assert.deepEqual(
      await Content.match({ match: 'Piz*' }).select({ from: db }),
      []
    )

    assert.deepEqual(
      await Content.match({ match: 'piz\\*' }).select({ from: db }),
      []
    )
    assert.deepEqual(
      await Content({ match: 'piz?a', word: $ }).select({ from: db }),
      [{ word: 'pizza', match: 'piz?a' }]
    )

    assert.deepEqual(
      await Content({ match: 'store/*', word: $ }).select({ from: db }),
      [
        { word: 'store/*', match: 'store/*' },
        { word: 'store/add', match: 'store/*' },
      ]
    )

    assert.deepEqual(
      await Content({ match: '*', word: $ }).select({ from: db }),
      [
        { word: 'pizza', match: '*' },
        { word: 'store/*', match: '*' },
        { word: 'store/add', match: '*' },
        { word: '*', match: '*' },
        { word: '[a-z]', match: '*' },
      ]
    )
  },

  'test find patterns that match text': async (assert) => {
    const Content = deduce({ word: String })
      .with({ words: Object })
      .when(({ word, words }) => [
        Fact({ the: 'word', is: words }),
        Fact({ of: words, is: word }),
        Text.match({
          this: 'store/list',
          pattern: word,
        }),
      ])

    assert.deepEqual(await Content().select({ from: db }), [
      { word: 'store/*' },
      { word: '*' },
    ])
  },

  'test revers pattern': async (assert) => {
    const Content = deduce({ word: String })
      .with({ words: Object })
      .when(({ word, words }) => [
        Fact({ the: 'word', is: words }),
        Fact({ of: words, is: word }),
        Text.match({
          this: word,
          pattern: '\\*',
        }),
      ])

    assert.deepEqual(await Content().select({ from: db }), [{ word: '*' }])
  },
}
