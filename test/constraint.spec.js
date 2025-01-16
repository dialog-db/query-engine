import * as DB from 'datalogia'
import * as Link from '../src/link.js'

const db = DB.Memory.create([
  {
    word: ['pizza', 'store/*', 'store/add', '*', '[a-z]'],
  },
])

/**
 * @type {import('entail').Suite}
 */
export const testConstraints = {
  like: async (assert) => {
    const words = DB.link()
    const word = DB.string()

    // assert.deepEqual(
    //   DB.query(db, {
    //     select: {
    //       word,
    //     },
    //     where: [DB.match([DB._, 'word', word]), DB.like(word, 'piz%')],
    //   }),
    //   [{ word: 'pizza' }]
    // )

    // assert.deepEqual(
    //   DB.query(db, {
    //     select: {
    //       word,
    //     },
    //     where: [DB.match([DB._, 'word', word]), DB.like(word, 'Piz%')],
    //   }),
    //   [{ word: 'pizza' }]
    // )

    // assert.deepEqual(
    //   DB.query(db, {
    //     select: {
    //       word,
    //     },
    //     where: [DB.match([DB._, 'word', word]), DB.like(word, 'Piz.*')],
    //   }),
    //   []
    // )

    assert.deepEqual(
      await DB.query(db, {
        select: {
          word,
        },
        where: [
          DB.match([DB._, 'word', words]),
          DB.match([words, DB._, word]),
          DB.like(word, 'piz?a'),
        ],
      }),
      [{ word: 'pizza' }]
    )
  },

  glob: async (assert) => {
    const word = DB.string()
    const words = DB.link()

    assert.deepEqual(
      await DB.query(db, {
        select: {
          word,
        },
        where: [
          DB.match([DB._, 'word', words]),
          DB.match([words, DB._, word]),
          DB.like(word, 'piz%'),
        ],
      }),
      [],
      'like pattern does not apply to glob'
    )

    assert.deepEqual(
      await DB.query(db, {
        select: {
          word,
        },
        where: [
          DB.match([DB._, 'word', words]),
          DB.match([words, DB._, word]),
          DB.like(word, 'piz*'),
        ],
      }),
      [{ word: 'pizza' }],
      '* matches anything'
    )

    assert.deepEqual(
      await DB.query(db, {
        select: {
          word,
        },
        where: [
          DB.match([DB._, 'word', words]),
          DB.match([words, DB._, word]),
          DB.like(word, 'Piz*'),
        ],
      }),
      [],
      'glob is case sensitive'
    )

    assert.deepEqual(
      await DB.query(db, {
        select: {
          word,
        },
        where: [
          DB.match([DB._, 'word', words]),
          DB.match([words, DB._, word]),
          DB.like(word, 'piz.\\*'),
        ],
      }),
      [],
      'does not care about regexp patterns'
    )

    assert.deepEqual(
      await DB.query(db, {
        select: {
          word,
        },
        where: [
          DB.match([DB._, 'word', words]),
          DB.match([words, DB._, word]),
          DB.like(word, 'piz?a'),
        ],
      }),
      [{ word: 'pizza' }],
      'can match single character'
    )

    assert.deepEqual(
      await DB.query(db, {
        select: {
          word,
        },
        where: [
          DB.match([DB._, 'word', words]),
          DB.match([words, DB._, word]),
          DB.like(word, 'store/*'),
        ],
      }),
      [{ word: 'store/*' }, { word: 'store/add' }]
    )

    assert.deepEqual(
      await DB.query(db, {
        select: {
          word,
        },
        where: [
          DB.match([DB._, 'word', words]),
          DB.match([words, DB._, word]),
          DB.like(word, '*'),
        ],
      }),
      [
        { word: 'pizza' },
        { word: 'store/*' },
        { word: 'store/add' },
        { word: '*' },
        { word: '[a-z]' },
      ]
    )

    assert.deepEqual(
      await DB.query(db, {
        select: {
          word,
        },
        where: [
          DB.match([DB._, 'word', words]),
          DB.match([words, DB._, word]),
          DB.like('store/list', word),
        ],
      }),
      [{ word: 'store/*' }, { word: '*' }],
      'can use term as pattern'
    )

    assert.deepEqual(
      await DB.query(db, {
        select: {
          word,
        },
        where: [
          DB.match([DB._, 'word', words]),
          DB.match([words, DB._, word]),
          DB.like(word, '\\*'),
        ],
      }),
      [{ word: '*' }],
      'can escape'
    )
  },
}
