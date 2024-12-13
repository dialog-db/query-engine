import * as DB from 'datalogia'
import { $ } from 'datalogia'

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
  'test recursion': async (assert) => {
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
  'using builder syntax': async (assert) => {
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

  'test iteration': async (assert) => {
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
