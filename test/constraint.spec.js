import { Memory, $, deduce, match, Text } from './lib.js'

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
      .where(({ word, words }) => [
        match({ the: 'word', is: words }),
        match({ of: words, is: word }),
        Text.match({
          this: word,
          pattern: 'piz*a',
        }),
      ])

    assert.deepEqual(await Piz().query({ from: db }), [{ word: 'pizza' }])
  },

  'make pattern rule': async (assert) => {
    const Content = deduce({ word: String, match: String })
      .with({ words: Object })
      .where(({ word, words, match: like }) => [
        match({ the: 'word', is: words }),
        match({ of: words, is: word }),
        Text.match({
          this: word,
          pattern: like,
        }),
      ])

    assert.deepEqual(
      await Content({ match: 'piz*', word: $ }).query({ from: db }),
      [{ word: 'pizza', match: 'piz*' }]
    )

    assert.deepEqual(
      await Content.match({ match: 'piz%' }).query({ from: db }),
      []
    )

    assert.deepEqual(
      await Content.match({ match: 'Piz*' }).query({ from: db }),
      []
    )

    assert.deepEqual(
      await Content.match({ match: 'piz\\*' }).query({ from: db }),
      []
    )
    assert.deepEqual(
      await Content({ match: 'piz?a', word: $ }).query({ from: db }),
      [{ word: 'pizza', match: 'piz?a' }]
    )

    assert.deepEqual(
      await Content({ match: 'store/*', word: $ }).query({ from: db }),
      [
        { word: 'store/*', match: 'store/*' },
        { word: 'store/add', match: 'store/*' },
      ]
    )

    assert.deepEqual(
      await Content({ match: '*', word: $ }).query({ from: db }),
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
      .where(({ word, words }) => [
        match({ the: 'word', is: words }),
        match({ of: words, is: word }),
        Text.match({
          this: 'store/list',
          pattern: word,
        }),
      ])

    assert.deepEqual(await Content().query({ from: db }), [
      { word: 'store/*' },
      { word: '*' },
    ])
  },

  'test revers pattern': async (assert) => {
    const Content = deduce({ word: String })
      .with({ words: Object })
      .where(({ word, words }) => [
        match({ the: 'word', is: words }),
        match({ of: words, is: word }),
        Text.match({
          this: word,
          pattern: '\\*',
        }),
      ])

    assert.deepEqual(await Content().query({ from: db }), [{ word: '*' }])
  },
}
