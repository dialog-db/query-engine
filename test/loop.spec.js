import { $, fact, Data, Math, Memory, API, Link, Collection } from './lib.js'

const id = Memory.entity

const db = Memory.create([
  // bafyr4ibnhlpn74i3mhyuzcdogwx2anttnxgypj2ne624cuicexiplexccm
  [id(0), 'data/type', 'list'],
  // bafyr4ici7rzb7o6bolqjex5cplywohpcew5je4juqauzrmikcvukdcdffm
  [id(1), 'meta/name', 'a'],
  // bafyr4iflco7n6qxijoxa67dcy7owvcw2k4piqkn623vflaqx6a3bwxrf2a
  [id(2), 'meta/name', 'b'],
  // bafyr4ihb4dub23vdtmgprodp7vcasiibd5luadf4h53krilrsbvjxdlvau
  [id(3), 'meta/name', 'c'],
  [id(0), 'list/next', id(1)],
  [id(1), 'list/next', id(2)],
  [id(2), 'list/next', id(3)],
])

/**
 * @type {import('entail').Suite}
 */
export const testRecursion = {
  'test ancestor': async (assert) => {
    const Parent = fact({
      the: 'child',
      parent: Object,
    })

    const Ancestor = fact({ of: Object })
      .with({ parent: Object })
      .when(({ this: ancestor, of: child, parent }) => ({
        direct: [Parent({ parent: ancestor, this: child })],
        transitive: [
          Parent({ parent, this: child }),
          Ancestor({ this: ancestor, of: parent }),
        ],
      }))

    const eve = {
      'person/name': 'Eve',
    }
    const adam = {
      'person/name': 'Adam',
      'child/parent': eve,
    }
    const jack = {
      'person/name': 'Jack',
      'child/parent': adam,
    }
    const mallory = {
      'person/name': 'Mallory',
      'child/parent': jack,
    }
    const bob = {
      'person/name': 'Bob',
      'child/parent': mallory,
    }
    const alice = {
      'person/name': 'Alice',
      'child/parent': bob,
    }

    const people = {
      alice,
      bob,
      mallory,
      jack,
      adam,
      eve,
    }

    const ancestors = await Ancestor().query({
      from: Memory.create([people]),
    })

    assert.deepEqual(
      new Set(ancestors),
      new Set([
        Ancestor.assert({ this: Link.of(bob), of: Link.of(alice) }),
        Ancestor.assert({ this: Link.of(mallory), of: Link.of(bob) }),
        Ancestor.assert({ this: Link.of(jack), of: Link.of(mallory) }),
        Ancestor.assert({ this: Link.of(adam), of: Link.of(jack) }),
        Ancestor.assert({ this: Link.of(mallory), of: Link.of(alice) }),
        Ancestor.assert({ this: Link.of(jack), of: Link.of(bob) }),
        Ancestor.assert({ this: Link.of(adam), of: Link.of(mallory) }),
        Ancestor.assert({ this: Link.of(jack), of: Link.of(alice) }),
        Ancestor.assert({ this: Link.of(adam), of: Link.of(bob) }),
        Ancestor.assert({ this: Link.of(adam), of: Link.of(alice) }),
        Ancestor.assert({ this: Link.of(eve), of: Link.of(alice) }),
        Ancestor.assert({ this: Link.of(eve), of: Link.of(bob) }),
        Ancestor.assert({ this: Link.of(eve), of: Link.of(mallory) }),
        Ancestor.assert({ this: Link.of(eve), of: Link.of(jack) }),
        Ancestor.assert({ this: Link.of(eve), of: Link.of(adam) }),
      ])
    )
  },

  'complex ancestor test': async (assert) => {
    const Parent = fact({
      the: 'child',
      parent: Object,
    })

    const Ancestor = fact({ of: Object })
      .with({ parent: Object })
      .when(({ this: ancestor, of: child, parent }) => ({
        direct: [Parent({ parent: ancestor, this: child })],
        transitive: [
          Parent({ parent, this: child }),
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

    const alice = Link.of('alice')
    const bob = Link.of('bob')
    const charlie = Link.of('charlie')
    const david = Link.of('david')
    const mallory = Link.of('mallory')
    const jack = Link.of('jack')
    const adam = Link.of('adam')
    const eve = Link.of('eve')
    const dave = Link.of('dave')
    const db = Memory.create([
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
    ])

    const ancestors = await Ancestor().query({ from: db })

    // Define the expected ancestor relationships
    const expectedAncestors = [
      // Direct parent relationships (10)
      Ancestor.assert({ this: bob, of: alice }),
      Ancestor.assert({ this: charlie, of: alice }),
      Ancestor.assert({ this: david, of: alice }),
      Ancestor.assert({ this: mallory, of: bob }),
      Ancestor.assert({ this: mallory, of: david }),
      Ancestor.assert({ this: jack, of: mallory }),
      Ancestor.assert({ this: dave, of: charlie }),
      Ancestor.assert({ this: jack, of: dave }),
      Ancestor.assert({ this: adam, of: jack }),
      Ancestor.assert({ this: eve, of: adam }),

      // Transitive relationships (19)
      Ancestor.assert({ this: mallory, of: alice }), // via bob or via david
      Ancestor.assert({ this: jack, of: alice }), // via bob/mallory or via david/mallory or via charlie/dave
      Ancestor.assert({ this: jack, of: bob }), // via mallory
      Ancestor.assert({ this: jack, of: david }), // via mallory
      Ancestor.assert({ this: jack, of: charlie }), // via dave
      Ancestor.assert({ this: adam, of: alice }), // via any path to jack
      Ancestor.assert({ this: adam, of: bob }), // via mallory/jack
      Ancestor.assert({ this: adam, of: david }), // via mallory/jack
      Ancestor.assert({ this: adam, of: mallory }), // via jack
      Ancestor.assert({ this: adam, of: charlie }), // via dave/jack
      Ancestor.assert({ this: adam, of: dave }), // via jack
      Ancestor.assert({ this: dave, of: alice }), // via charlie
      Ancestor.assert({ this: eve, of: alice }), // via any path to adam
      Ancestor.assert({ this: eve, of: bob }), // via mallory/jack/adam
      Ancestor.assert({ this: eve, of: david }), // via mallory/jack/adam
      Ancestor.assert({ this: eve, of: mallory }), // via jack/adam
      Ancestor.assert({ this: eve, of: jack }), // via adam
      Ancestor.assert({ this: eve, of: charlie }), // via dave/jack/adam
      Ancestor.assert({ this: eve, of: dave }), // via jack/adam
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
    const Range = fact({ n: Number, from: Number, to: Number })
      .with({ m: Number })
      .when(({ n, from, to, m }) => ({
        base: [
          Data.less({ this: from, than: to }),
          Data.same({ this: from, as: n }),
          Range.claim({ n, from, to }),
        ],
        step: [
          Data.less({ this: from, than: to }),
          Math.Sum({ of: from, with: 1, is: m }),
          Range({ n, from: m, to: to }),
        ],
      }))

    assert.deepEqual(
      await Range.match({ from: 1, to: 5 }).query({ from: db }),
      [
        Range.assert({ from: 1, n: 1, to: 5 }),
        Range.assert({
          this: Range.assert({ from: 2, n: 2, to: 5 }).this,
          from: 1,
          n: 2,
          to: 5,
        }),
        Range.assert({
          this: Range.assert({ from: 3, n: 3, to: 5 }).this,
          from: 1,
          n: 3,
          to: 5,
        }),
        Range.assert({
          this: Range.assert({ from: 4, n: 4, to: 5 }).this,
          from: 1,
          n: 4,
          to: 5,
        }),
      ]
    )
  },

  'test recursion': async (assert) => {
    const Head = fact({ the: 'list', next: Object })

    const List = Head.with({ transient: Object }).when(
      ({ transient, ...head }) => ({
        head: [Head(head)],
        child: [
          Head({ this: head.this, next: transient }),
          List({ this: transient, next: head.next }),
        ],
      })
    )

    const Meta = fact({
      the: 'meta',
      name: String,
    })

    const Connection = fact({
      from: Object,
      to: Object,
      name: String,
    }).where(({ from, to, name }) => [
      List({ this: from, next: to }),
      Meta({ this: to, name: name }),
      Connection.claim({ from, to, name }),
    ])

    return assert.deepEqual(await Connection().query({ from: db }), [
      Connection.assert({ from: id(0), to: id(1), name: 'a' }),
      Connection.assert({ from: id(1), to: id(2), name: 'b' }),
      Connection.assert({ from: id(0), to: id(2), name: 'b' }),
      Connection.assert({ from: id(2), to: id(3), name: 'c' }),
      Connection.assert({ from: id(1), to: id(3), name: 'c' }),
      Connection.assert({ from: id(0), to: id(3), name: 'c' }),
    ])
  },
  'test rooted recursion': async (assert) => {
    // return 'seems to enter infinite loop'
    const Content = fact({ the: 'data', type: String })
    const Head = fact({ the: 'list', next: Object })
    const Meta = fact({ the: 'meta', name: String })
    const List = Head.with({ trasitive: Object }).when(
      ({ trasitive, ...head }) => ({
        direct: [Head(head)],
        trasitive: [
          Head({ this: head.this, next: trasitive }),
          List({ this: trasitive, next: head.next }),
        ],
      })
    )

    const Node = fact({
      node: Object,
      name: String,
    })
      .with({ root: Object })
      .where(({ node, name, root }) => [
        Content({ this: root, type: 'list' }),
        List({ this: root, next: node }),
        Meta({ this: node, name }),
        Node.claim({ node, name }),
      ])

    assert.deepEqual(await Node().query({ from: db }), [
      Node.assert({ node: id(1), name: 'a' }),
      Node.assert({ node: id(2), name: 'b' }),
      Node.assert({ node: id(3), name: 'c' }),
    ])
  },
  'test implicit': async (assert) => {
    const Content = fact({ the: 'data', type: String })
    const Head = fact({ the: 'list', next: Object })
    const Meta = fact({ the: 'meta', name: String })
    const List = Head.with({ transient: Object }).when(
      ({ transient, ...head }) => ({
        head: [Head(head)],
        child: [
          Head({ this: head.this, next: transient }),
          List({ this: transient, next: head.next }),
        ],
      })
    )

    const Implicit = fact({
      at: String,
      is: Object,
      default: null,
    }).when(({ at, this: of, is, default: implicit, _ }) => ({
      explicit: [
        Collection({ this: of, at, of: is }),
        Data.Type({ of: implicit, is: _ }),
      ],
      implicit: [
        Collection.not({ this: of, at }),
        Data.same({ this: implicit, as: is }),
      ],
    }))

    const Node = fact({
      each: Object,
      name: String,
      next: Object,
    })
      .with({ root: Object })
      .where(({ each, name, next, root }) => [
        Content({ this: root, type: 'list' }),
        List({ this: root, next: each }),
        Meta({ this: each, name }),
        Implicit({
          this: each,
          at: 'list/next',
          is: next,
          default: null,
        }),
        Node.claim({ each, name, next }),
      ])

    assert.deepEqual(await Node().query({ from: db }), [
      Node.assert({ each: id(1), name: 'a', next: id(2) }),
      Node.assert({ each: id(2), name: 'b', next: id(3) }),
      // @ts-expect-error - inference doesn't know next is entity | null
      Node.assert({ each: id(3), name: 'c', next: null }),
    ])
  },

  'test recursion termination': async (assert) => {
    const Content = fact({ the: 'data', type: String })
    const Head = fact({ the: 'list', next: Object })
    const Meta = fact({ the: 'meta', name: String })
    const List = Head.with({ trasitive: Object }).when(
      ({ trasitive, ...head }) => ({
        direct: [Head(head)],
        trasitive: [
          Head({ this: head.this, next: trasitive }),
          List({ this: trasitive, next: head.next }),
        ],
      })
    )

    const Node = fact({
      node: Object,
      name: String,
    })
      .with({ root: Object })
      .where(({ node, name, root }) => [
        Content({ this: root, type: 'list' }),
        List({ this: root, next: node }),
        Meta({ this: node, name }),
        Node.claim({ node, name }),
      ])

    assert.deepEqual(await Node().query({ from: db }), [
      Node.assert({
        node: id(1),
        name: 'a',
      }),
      Node.assert({
        node: id(2),
        name: 'b',
      }),
      Node.assert({
        node: id(3),
        name: 'c',
      }),
    ])
  },
}
