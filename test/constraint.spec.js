import { Memory, $, fact, Collection, Text } from './lib.js'

const db = Memory.create({
  import: {
    'content/words': ['pizza', 'store/*', 'store/add', '*', '[a-z]'],
  },
})

const Content = fact({ the: 'content', words: Object })

/**
 * @type {import('entail').Suite}
 */
export const testConstraints = {
  'test like': async (assert) => {
    const Piz = fact({ word: String })
      .with({ source: Object, words: Object })
      .where(({ word, words, _ }) => [
        Content({ words }),
        Collection({ this: words, of: word }),
        Text.match({
          this: word,
          pattern: 'piz*a',
        }),
        Piz.claim({ word }),
      ])

    assert.deepEqual(await Piz().query({ from: db }), [
      Piz.assert({ word: 'pizza' }),
    ])
  },

  'make pattern rule': async (assert) => {
    const Like = fact({ word: String, like: String })
      .with({ words: Object })
      .where(({ word, words, like }) => [
        Content({ words }),
        Collection({ this: words, of: word }),
        Text.match({
          this: word,
          pattern: like,
        }),
        Like.claim({ word, like }),
      ])

    assert.deepEqual(
      await Like({ like: 'piz*', word: $ }).query({ from: db }),
      [Like.assert({ word: 'pizza', like: 'piz*' })]
    )

    assert.deepEqual(await Like.match({ like: 'piz%' }).query({ from: db }), [])

    assert.deepEqual(await Like.match({ like: 'Piz*' }).query({ from: db }), [])

    assert.deepEqual(
      await Like.match({ like: 'piz\\*' }).query({ from: db }),
      []
    )
    assert.deepEqual(
      await Like({ like: 'piz?a', word: $ }).query({ from: db }),
      [Like.assert({ word: 'pizza', like: 'piz?a' })]
    )

    assert.deepEqual(
      await Like({ like: 'store/*', word: $ }).query({ from: db }),
      [
        Like.assert({ word: 'store/*', like: 'store/*' }),
        Like.assert({ word: 'store/add', like: 'store/*' }),
      ]
    )

    assert.deepEqual(await Like({ like: '*', word: $ }).query({ from: db }), [
      Like.assert({ word: 'pizza', like: '*' }),
      Like.assert({ word: 'store/*', like: '*' }),
      Like.assert({ word: 'store/add', like: '*' }),
      Like.assert({ word: '*', like: '*' }),
      Like.assert({ word: '[a-z]', like: '*' }),
    ])
  },

  'test find patterns that match text': async (assert) => {
    const Pattern = fact({ pattern: String })
      .with({ words: Object })
      .where(({ pattern, words }) => [
        Content({ words }),
        Collection({ this: words, of: pattern }),
        Text.match({
          this: 'store/list',
          pattern,
        }),
        Pattern.claim({ pattern }),
      ])

    assert.deepEqual(await Pattern().query({ from: db }), [
      Pattern.assert({ pattern: 'store/*' }),
      Pattern.assert({ pattern: '*' }),
    ])
  },

  'test revers pattern': async (assert) => {
    const Match = fact({ word: String })
      .with({ words: Object })
      .where(({ word, words }) => [
        Content({ words }),
        Collection({ this: words, of: word }),
        Text.match({
          this: word,
          pattern: '\\*',
        }),
        Match.claim({ word }),
      ])

    assert.deepEqual(await Match().query({ from: db }), [
      Match.assert({ word: '*' }),
    ])
  },
}
