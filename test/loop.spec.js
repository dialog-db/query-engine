import * as DB from 'datalogia'
import { $ } from 'datalogia'
import { deduce, Fact, Data, Math } from '../src/syntax.js'
import { derive } from '../src/fact.js'

const id = DB.Memory.entity

const db = DB.Memory.create([
  // bafyr4ibnhlpn74i3mhyuzcdogwx2anttnxgypj2ne624cuicexiplexccm
  [id(0), 'data/type', 'list'],
  // bafyr4ici7rzb7o6bolqjex5cplywohpcew5je4juqauzrmikcvukdcdffm
  [id(1), 'name', 'a'],
  // bafyr4iflco7n6qxijoxa67dcy7owvcw2k4piqkn623vflaqx6a3bwxrf2a
  [id(2), 'name', 'b'],
  // bafyr4ihb4dub23vdtmgprodp7vcasiibd5luadf4h53krilrsbvjxdlvau
  [id(3), 'name', 'c'],
  [id(0), 'list/next', id(1)],
  [id(1), 'list/next', id(2)],
  [id(2), 'list/next', id(3)],
])

/**
 * @type {import('entail').Suite}
 */
export const testRecursion = {
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

    const alice = /** @type {DB.Entity & any} */ ('alice') //id('alice')
    const bob = /** @type {any} */ ('bob')
    const mallory = /** @type {any} */ ('mallory')
    const jack = /** @type {any} */ ('jack')
    const adam = /** @type {any} */ ('adam')
    const eve = /** @type {any} */ ('eve')

    const ancestors = await Ancestor().select({
      from: DB.Memory.create([
        [alice, 'child/parent', bob],
        [bob, 'child/parent', mallory],
        [mallory, 'child/parent', jack],
        [jack, 'child/parent', adam],
        [adam, 'child/parent', eve],
      ]),
    })

    assert.deepEqual(
      ancestors
        .map((row) => JSON.stringify(row))
        .sort()
        .join('\n'),
      [
        { this: bob, of: alice },
        { this: mallory, of: bob },
        { this: jack, of: mallory },
        { this: adam, of: jack },
        { this: mallory, of: alice },
        { this: jack, of: bob },
        { this: adam, of: mallory },
        { this: jack, of: alice },
        { this: adam, of: bob },
        { this: adam, of: alice },
        { this: eve, of: alice },
        { this: eve, of: bob },
        { this: eve, of: mallory },
        { this: eve, of: jack },
        { this: eve, of: adam },
      ]
        .map((row) => JSON.stringify(row))
        .sort()
        .join('\n')
    )
  },

  'complex ancestor test': async (assert) => {
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

    // Create a complex family tree with multiple paths to the same nodes
    //
    // Family Tree Structure (→ means "has parent"):
    //
    //      david → mallory
    //     /               \
    // alice → bob         jack
    //     \     \        /   \
    //      \     mallory     adam → eve
    //       \                /
    //        charlie → dave
    //
    // Note: Both bob and david have mallory as parent
    // Note: Both mallory and dave have jack as parent
    // Note: There are multiple paths from alice to jack (and thus to adam and eve)

    const alice = /** @type {DB.Entity & any} */ ('alice')
    const bob = /** @type {any} */ ('bob')
    const charlie = /** @type {any} */ ('charlie')
    const david = /** @type {any} */ ('david')
    const mallory = /** @type {any} */ ('mallory')
    const jack = /** @type {any} */ ('jack')
    const adam = /** @type {any} */ ('adam')
    const eve = /** @type {any} */ ('eve')
    const dave = /** @type {any} */ ('dave')

    const ancestors = await Ancestor().select({
      from: DB.Memory.create([
        // First branch
        [alice, 'child/parent', bob],
        [bob, 'child/parent', mallory],
        [mallory, 'child/parent', jack],

        // Second branch
        [alice, 'child/parent', charlie],
        [charlie, 'child/parent', dave],
        [dave, 'child/parent', jack],

        // Third branch
        [alice, 'child/parent', david],
        [david, 'child/parent', mallory],

        // Common descendants
        [jack, 'child/parent', adam],
        [adam, 'child/parent', eve],
      ]),
    })

    // Define the expected ancestor relationships
    const expectedAncestors = [
      // Direct parent relationships (10)
      { this: bob, of: alice },
      { this: charlie, of: alice },
      { this: david, of: alice },
      { this: mallory, of: bob },
      { this: mallory, of: david },
      { this: jack, of: mallory },
      { this: dave, of: charlie },
      { this: jack, of: dave },
      { this: adam, of: jack },
      { this: eve, of: adam },

      // Transitive relationships (19)
      { this: mallory, of: alice }, // via bob or via david
      { this: jack, of: alice }, // via bob/mallory or via david/mallory or via charlie/dave
      { this: jack, of: bob }, // via mallory
      { this: jack, of: david }, // via mallory
      { this: jack, of: charlie }, // via dave
      { this: adam, of: alice }, // via any path to jack
      { this: adam, of: bob }, // via mallory/jack
      { this: adam, of: david }, // via mallory/jack
      { this: adam, of: mallory }, // via jack
      { this: adam, of: charlie }, // via dave/jack
      { this: adam, of: dave }, // via jack
      { this: dave, of: alice }, // via charlie
      { this: eve, of: alice }, // via any path to adam
      { this: eve, of: bob }, // via mallory/jack/adam
      { this: eve, of: david }, // via mallory/jack/adam
      { this: eve, of: mallory }, // via jack/adam
      { this: eve, of: jack }, // via adam
      { this: eve, of: charlie }, // via dave/jack/adam
      { this: eve, of: dave }, // via jack/adam
    ]

    // Create sets for comparison (using string representations for equality comparison)
    const expectedSet = new Set(
      expectedAncestors.map((rel) =>
        JSON.stringify({ this: rel.this, of: rel.of })
      )
    )

    const actualSet = new Set(
      ancestors.map((rel) => JSON.stringify({ this: rel.this, of: rel.of }))
    )

    // Find missing and extra relationships
    const missing = [...expectedSet].filter((rel) => !actualSet.has(rel))
    const extra = [...actualSet].filter((rel) => !expectedSet.has(rel))

    if (missing.length > 0 || extra.length > 0) {
      console.log(
        'Missing relationships:',
        missing.map((r) => JSON.parse(r))
      )
      console.log(
        'Extra relationships:',
        extra.map((r) => JSON.parse(r))
      )
    }

    // Verify we have the correct total number of unique ancestor relationships
    // Direct relationships: 10
    // Transitive relationships: 19
    // Total: 29 unique relationships
    assert.strictEqual(
      actualSet.size,
      29,
      `Should have 29 total unique ancestor relationships, but got ${actualSet.size}`
    )
  },
  'test traverse': async (assert) => {
    const Range = deduce({ n: Number, from: Number, to: Number })
      .with({ m: Number })
      .when(({ n, from, to, m }) => ({
        base: [
          Data.less({ this: from, than: to }),
          Data.same({ this: from, as: n }),
        ],
        step: [
          Data.less({ this: from, than: to }),
          Math.Sum({ of: from, with: 1, is: m }),
          Range({ n, from: m, to: to }),
        ],
      }))

    assert.deepEqual(
      await Range({ from: 1, to: 5, n: $ }).select({ from: db }),
      [
        { from: 1, n: 1, to: 5 },
        { from: 1, n: 2, to: 5 },
        { from: 1, n: 3, to: 5 },
        { from: 1, n: 4, to: 5 },
      ]
    )
  },

  'test recursion': async (assert) => {
    // const list = DB.link()
    // const item = DB.link()
    // const head = DB.link()
    // const Child = DB.rule({
    //   case: { let: item, of: list },
    //   when: [
    //     DB.or(
    //       // head of the list is the item
    //       DB.match([list, 'list/next', item]),
    //       // or item is a child of the head
    //       DB.and(
    //         DB.match([list, 'list/next', head]),
    //         DB.recur({ let: item, of: head })
    //       )
    //     ),
    //   ],
    // })

    const Child = deduce({ of: Object, is: Object })
      .with({ head: Object })
      .when(({ of, is, head }) => ({
        head: [Fact({ the: 'list/next', of, is })],
        child: [
          Fact({ the: 'list/next', of, is: head }),
          Child({ of: head, is }),
        ],
      }))

    const Implicit = deduce({
      the: String,
      of: Object,
      is: Object,
      default: { Null: {} },
    }).when(({ the, of, is, default: implicit, _ }) => ({
      explicit: [Fact({ the, of, is }), Data.Type({ of: implicit, is: _ })],
      implicit: [Fact.not({ the, of }), Data.same({ this: implicit, as: is })],
    }))

    // const test = await Implicit({
    //   the: 'list/next',
    //   of: id(3),
    //   is: Implicit.$.is,
    //   default: null,
    // }).select({ from: db })

    const NestRecursive = deduce({
      of: Object,
      is: Object,
      name: String,
    }).where(({ of, is, name }) => [
      Child({ of, is }),
      Fact({ the: 'name', of: is, is: name }),
    ])

    const result = await NestRecursive().select({ from: db })

    assert.deepEqual(result, [
      { of: id(0), is: id(1), name: 'a' },
      { of: id(1), is: id(2), name: 'b' },
      { of: id(0), is: id(2), name: 'b' },
      { of: id(2), is: id(3), name: 'c' },
      { of: id(1), is: id(3), name: 'c' },
      { of: id(0), is: id(3), name: 'c' },
    ])

    return 'seems to enter infinite loop'

    const RootedRecursion = deduce({
      node: Object,
      name: String,
    })
      .with({ root: Object })
      .where(({ node, name, root }) => [
        Fact({ the: 'data/type', of: root, is: 'list' }),
        Child({ of: root, is: node }),
        Fact({ the: 'name', of: node, is: name }),
      ])

    console.log(await RootedRecursion().select({ from: db }))

    const Query = deduce({
      each: Object,
      // name: String,
      // next: Object
    })
      .with({ root: Object })
      .where(
        ({
          each,
          // name,
          // next,
          root,
        }) => [
          Fact({ the: 'data/type', of: root, is: 'list' }),
          Child({ of: root, is: each }),
          // Fact({ the: 'name', of: each, is: name }),
          // Implicit({
          //   the: 'list/next',
          //   of: each,
          //   is: next,
          //   default: null,
          // }),
        ]
      )

    const matches = await Query().select({ from: db })
    return console.log(matches)

    // const root = DB.link()
    // const each = DB.link()
    // const next = DB.variable()

    // const name = DB.string()

    // const matches = await DB.query(db, {
    //   select: {
    //     id: each,
    //     name,
    //     next,
    //   },
    //   where: [
    //     DB.match([root, 'data/type', 'list']),
    //     Child.match({ let: each, of: root }),
    //     DB.match([each, 'name', name]),
    //     DB.or(
    //       DB.match([each, 'list/next', next]),
    //       DB.not(DB.match([each, 'list/next', next]))
    //     ),
    //   ],
    // })

    // assert.deepEqual(
    //   [...matches],
    //   [
    //     { id: id(1), name: 'a', next: id(2) },
    //     { id: id(2), name: 'b', next: id(3) },
    //     // @ts-ignore
    //     { id: id(3), name: 'c', next: undefined },
    //   ]
    // )
  },

  'test recursion termination': async (assert) => {
    const Child = deduce({ of: Object, is: Object })
      .with({ head: Object })
      .when(({ of, is, head }) => ({
        head: [Fact({ the: 'list/next', of, is })],
        child: [
          Fact({ the: 'list/next', of, is: head }),
          Child({ of: head, is }),
        ],
      }))

    const RootedRecursion = deduce({
      node: Object,
      name: String,
    })
      .with({ root: Object })
      .where(({ node, name, root }) => [
        Fact({ the: 'data/type', of: root, is: 'list' }),
        Child({ of: root, is: node }),
        Fact({ the: 'name', of: node, is: name }),
      ])

    assert.deepEqual(await RootedRecursion().select({ from: db }), [
      {
        node: id(1),
        name: 'a',
      },
      {
        node: id(2),
        name: 'b',
      },
      {
        node: id(3),
        name: 'c',
      },
    ])
  },
}
