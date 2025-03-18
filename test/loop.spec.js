import * as DB from 'datalogia'
import { $ } from 'datalogia'
import { deduce, induce, loop, Fact, Data, Math } from '../src/syntax.js'
import { derive } from '../src/fact.js'

const id = DB.Memory.entity

const db = DB.Memory.create([
  [id(1), 'name', 'a'],
  [id(2), 'name', 'b'],
  [id(3), 'name', 'c'],
  [id(0), 'data/type', 'list'],
  [id(0), 'list/next', id(1)],
  [id(1), 'list/next', id(2)],
  [id(2), 'list/next', id(3)],
])

/**
 * @type {import('entail').Suite}
 */
export const testRecursion = {
  'skip test ancestor loop': async (assert) => {
    const Parent = deduce({ this: Object, of: Object }).when(
      ({ this: parent, of: child }) => [
        Fact({ the: 'child/parent', of: child, is: parent }),
      ]
    )

    const Ancestor = induce({ this: Object, of: Object })
      .when((terms) => [Parent(terms)])
      .with({ parent: Object })
      .repeat(({ this: ancestor, parent }) => ({
        this: ancestor,
        of: parent,
      }))
      .while(({ this: ancestor, parent }) => [
        Parent({ this: ancestor, of: parent }),
      ])

    const alice = /** @type {DB.Entity & any} */ ({ '/': 'alice' }) //id('alice')
    const bob = /** @type {any} */ ({ '/': 'bob' })
    const mallory = /** @type {any} */ ({ '/': 'mallory' })

    const ancestors = await Ancestor().select({
      from: DB.Memory.create([
        [alice, 'child/parent', bob],
        [bob, 'child/parent', mallory],
      ]),
    })

    console.log(ancestors)
  },
  'test ancestor': async (assert) => {
    const Parent = deduce({ this: Object, of: Object }).when(
      ({ this: parent, of: child }) => [
        Fact({ the: 'child/parent', of: child, is: parent }),
      ]
    )

    const Ancestor = deduce({ this: Object, of: Object })
      .with({ parent: Object })
      .when(({ this: ancestor, of: child, parent }) => ({
        direct: [Parent({ this: ancestor, of: child })],
        transitive: [
          Parent({ this: parent, of: child }),
          Ancestor({ this: ancestor, of: parent }),
        ],
      }))

    const alice = /** @type {DB.Entity & any} */ ({ '/': 'alice' }) //id('alice')
    const bob = /** @type {any} */ ({ '/': 'bob' })
    const mallory = /** @type {any} */ ({ '/': 'mallory' })

    const ancestors = await Ancestor().select({
      from: DB.Memory.create([
        [alice, 'child/parent', bob],
        [bob, 'child/parent', mallory],
      ]),
    })

    console.log(ancestors)
  },
  'skip test traverse': async (assert) => {
    induce({ n: Number, from: Number, to: Number })
      .with({ next: Number })
      .while(({ from, to }) => [Data.less({ this: from, than: to })])
      .do(({ n, from, next, to }) => [
        Data.same({ this: from, as: n }),
        Math.Sum({ of: n, with: 1, is: next }),
      ])
      .repeat(({ n, next, to }) => ({ n, from: next, to }))

    induce({ n: Number, from: Number, to: Number })
      .with({ next: Number })
      .when(({ n, from, next, to }) => [
        Data.less({ this: from, than: to }),
        Data.same({ this: from, as: n }),
        Math.Sum({ of: n, with: 1, is: next }),
      ])
      .repeat(({ n, next, to }) => ({ n, from: next, to }))

    const Loop = induce({ n: Number, from: Number, to: Number })
      .with({ next: Number })
      .when(({ n, from, next, to }) => [
        Data.less({ this: from, than: to }),
        Data.same({ this: from, as: n }),
        Math.Sum({ of: n, with: 1, is: next }),
        Loop({ n, from: next, to }),
      ])
  },

  'skip test loop': async (assert) => {
    deduce({ n: Number, from: Number, to: Number })
      .with({ next: Number })
      .when(({ n, from, to, next }) => [
        Data.less({ this: from, than: to }),
        Data.same({ this: from, as: n }),
        Math.Sum({ of: n, with: 1, is: next }),
      ])
    // .loop(({ n, from, to, next }) => ({ recur: { n, from: next, to } }))

    // .repeat(({ n, from, to }) => [
    //   Math.Sum({ of: from, with: 1, is: n }),
    //   Data.less(({ this: n, than: to }))
    // ])
  },
  'skip test recursion': async (assert) => {
    const list = DB.link()
    const item = DB.link()
    const head = DB.link()
    const Child = DB.rule({
      case: { let: item, of: list },
      when: [
        DB.or(
          // head of the list is the item
          DB.match([list, 'list/next', item]),
          // or item is a child of the head
          DB.and(
            DB.match([list, 'list/next', head]),
            DB.recur({ let: item, of: head })
          )
        ),
      ],
    })

    const root = DB.link()
    const each = DB.link()
    const next = DB.variable()

    const name = DB.string()

    const matches = await DB.query(db, {
      select: {
        id: each,
        name,
        next,
      },
      where: [
        DB.match([root, 'data/type', 'list']),
        Child.match({ let: each, of: root }),
        DB.match([each, 'name', name]),
        DB.or(
          DB.match([each, 'list/next', next]),
          DB.not(DB.match([each, 'list/next', next]))
        ),
      ],
    })

    assert.deepEqual(
      [...matches],
      [
        { id: id(1), name: 'a', next: id(2) },
        { id: id(2), name: 'b', next: id(3) },
        // @ts-ignore
        { id: id(3), name: 'c', next: undefined },
      ]
    )
  },
  'skip using builder syntax': async (assert) => {
    const Child = DB.rule({
      case: { of: $.list },
      when() {
        return [
          DB.or(
            // head of the list is the item
            DB.match([$.list, 'list/next', $]),
            // or item is a child of the head
            DB.and(
              DB.match([$.list, 'list/next', $.head]),
              this.match({ this: $, of: $.head })
            )
          ),
        ]
      },
    })

    const root = DB.link()
    const each = DB.link()
    const next = DB.variable()

    const name = DB.string()

    const matches = await DB.query(db, {
      select: {
        id: each,
        name,
        next,
      },
      where: [
        DB.match([root, 'data/type', 'list']),
        Child.match({ this: each, of: root }),
        DB.match([each, 'name', name]),
        DB.or(
          DB.match([each, 'list/next', next]),
          DB.not(DB.match([each, 'list/next', next]))
        ),
      ],
    })

    assert.deepEqual(
      [...matches],
      [
        { id: id(1), name: 'a', next: id(2) },
        { id: id(2), name: 'b', next: id(3) },
        // @ts-ignore
        { id: id(3), name: 'c', next: undefined },
      ]
    )
  },

  'skip test iteration': async (assert) => {
    const Iterate = DB.rule({
      case: { from: $.from, to: $.to },
      when() {
        return [
          {
            Or: [
              {
                And: [
                  { Match: [[$.from, $.to], '<'] },
                  { Match: [$.from, '==', $] },
                ],
              },
              {
                And: [
                  { Match: [[$.from, $.to], '>'] },
                  { Match: [$.from, '==', $] },
                ],
              },
              {
                And: [
                  { Match: [[$.from, $.to], '<'] },
                  { Match: [[$.from, 1], '+', $.next] },
                  this.match({ from: $.next, to: $.to }),
                ],
              },
              {
                And: [
                  { Match: [[$.from, $.to], '>'] },
                  { Match: [[$.from, 1], '-', $.next] },
                  this.match({ from: $.next, to: $.to }),
                ],
              },
            ],
          },
        ]
      },
    })

    const r1_5 = await DB.query(db, {
      select: { n: $.value },
      where: [Iterate.match({ this: $.value, from: 1, to: 5 })],
    })

    assert.deepEqual([...r1_5], [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }])

    const r5_1 = await DB.query(db, {
      select: { n: $.value },
      where: [Iterate.match({ this: $.value, from: 5, to: 1 })],
    })
    assert.deepEqual([...r5_1], [{ n: 5 }, { n: 4 }, { n: 3 }, { n: 2 }])
  },
}
