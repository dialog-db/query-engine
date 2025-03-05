import { $, Memory, API, plan } from 'datalogia'
import * as Link from '../src/link.js'
import * as Schema from '../src/schema.js'
import * as Syntax from '../src/syntax.js'

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

    const rule = Syntax.rule({
      match: { word: $.word },
      when: [
        Syntax.Fact({ the: 'word', is: $.words }),
        Syntax.Fact({ of: $.words, is: $.word }),
        Syntax.Text.match({
          text: $.word,
          like: 'piz*a',
        }),
        // Syntax.apply('text/like', { text: $.word, pattern: 'piz*a' }),
        // { match: { the: 'word', is: $.words } },
        // { match: { of: $.words, is: $.word } },
        // { match: { text: $.word, pattern: 'piz*a' }, operator: 'text/like' },
      ],
    })

    assert.deepEqual(await rule.apply({ word: $.q }).select({ from: db }), [
      { word: 'pizza' },
    ])

    // assert.deepEqual(
    //   await DB.query(db, {
    //     select: {
    //       word,
    //     },
    //     where: [
    //       DB.match([DB._, 'word', words]),
    //       DB.match([words, DB._, word]),
    //       DB.like(word, 'piz?a'),
    //     ],
    //   }),
    //   [{ word: 'pizza' }]
    // )
  },

  'skip glob': async (assert) => {
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
