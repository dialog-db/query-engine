import * as DB from 'datalogia'
import * as Analyzer from '../src/analyzer.js'
import * as Schema from '../src/schema.js'
import { $, Task } from 'datalogia'
import * as Link from '../src/link.js'

const db = DB.Memory.create([
  {
    plain: {
      a: { x: 0, y: 2 },
      b: { x: 3, y: 4 },

      ab: { from: { x: 0, y: 2 }, to: { x: 3, y: 4 } },
      ba: { from: { x: 3, y: 4 }, to: { x: 0, y: 2 } },
    },
    points: [
      { 'Point/x': 0, 'Point/y': 0, v: 0 },
      { 'Point/x': 0, 'Point/y': '1', v: 2 },
      { 'Point/x': 1, 'Point/y': 1, v: 3 },
      { 'Point/x': 2, 'Point/y': 2, v: 4 },
    ],
    lines: [
      {
        'Line/a': { 'Point/x': 1, 'Point/y': 0 },
        'Line/b': { 'Point/x': 10, 'Point/y': 12 },
      },
      {
        'Line/a': { 'Point/x': 1, 'Point/y': 10 },
        'Line/b': { 'Point/x': 10, 'Point/y': 2 },
      },
    ],
    people: {
      alice: {
        'Person/name': 'Alice',
      },
      bob: {
        'Person/name': 'Bob',
      },
      mallory: {
        'Person/name': 'Mallory',
      },
    },
  },
])

const mallory = {
  'Person/name': 'Mallory',
}

const bob = {
  'Person/name': 'Bob',
  'Manages/employee': mallory,
}

const alice = {
  'Person/name': 'Alice',
  'Manages/employee': bob,
}

/**
 * @type {import('entail').Suite}
 */
export const testSchema = {
  'basic entity': async (assert) => {
    const Point = Schema.entity({
      x: Number,
      y: Number,
    })

    const result = await Point({ x: 0 }).select({
      from: db,
    })

    assert.deepEqual(result, [
      Point.new({
        x: 0,
        y: 2,
        this: Link.of({ x: 0, y: 2 }),
      }),
    ])
  },

  'composite entity': async (assert) => {
    const Point = Schema.entity({
      x: Number,
      y: Number,
    })

    const Line = Schema.entity({
      from: Point,
      to: Point,
    })

    const result = await Line().select({
      from: db,
    })

    assert.deepEqual(result, [
      Line.new({
        this: Link.of({ from: { x: 0, y: 2 }, to: { x: 3, y: 4 } }),
        from: Point.new({
          this: Link.of({ x: 0, y: 2 }),
          x: 0,
          y: 2,
        }),
        to: Point.new({
          this: Link.of({ x: 3, y: 4 }),
          x: 3,
          y: 4,
        }),
      }),
      Line.new({
        this: Link.of({ from: { x: 3, y: 4 }, to: { x: 0, y: 2 } }),
        from: Point.new({
          this: Link.of({ x: 3, y: 4 }),
          x: 3,
          y: 4,
        }),
        to: Point.new({
          this: Link.of({ x: 0, y: 2 }),
          x: 0,
          y: 2,
        }),
      }),
    ])
  },

  'can do a nested selection': async (assert) => {
    const Point = Schema.entity({
      x: Number,
      y: Number,
    })

    const Line = Schema.entity({
      from: Point,
      to: Point,
    })

    const result = await Line({ to: { y: 2 } }).select({ from: db })

    assert.deepEqual(result, [
      Line.new({
        this: Link.of({ from: { x: 3, y: 4 }, to: { x: 0, y: 2 } }),
        from: Point.new({
          this: Link.of({ x: 3, y: 4 }),
          x: 3,
          y: 4,
        }),
        to: Point.new({
          this: Link.of({ x: 0, y: 2 }),
          x: 0,
          y: 2,
        }),
      }),
    ])
  },

  'define rule from schema': async (assert) => {
    const Cursor = Schema.entity({
      top: Number,
      left: Number,
    }).when(($) => [
      { match: { the: 'Point/x', of: $.this, is: $.top } },
      { match: { the: 'Point/y', of: $.this, is: $.left } },
    ])

    const result = await Cursor({ top: 0 }).select({ from: db })

    assert.deepEqual(result, [
      Cursor.new({
        top: 0,
        left: 0,
        this: Link.of({ 'Point/x': 0, 'Point/y': 0, v: 0 }),
      }),
    ])
  },

  'test negation': async (assert) => {
    const Point = Schema.entity({
      x: Number,
      y: Number,
    })

    const RawPoint = Point.when((point) => [
      { match: { the: 'Point/x', of: point.this, is: point.x } },
      { match: { the: 'Point/y', of: point.this, is: point.y } },
    ])

    const NonZeroPoint = Point.when((point) => [
      RawPoint(point),
      RawPoint.not({ this: point.this, x: 0, y: 0 }),
    ])

    const result = await NonZeroPoint({ y: 0 }).select({ from: db })

    assert.deepEqual(result, [
      NonZeroPoint.new({
        this: Link.of({ 'Point/x': 1, 'Point/y': 0 }),
        x: 1,
        y: 0,
      }),
    ])
  },

  'test managers relation': async (assert) => {
    const Person = Schema.entity({
      name: String,
    }).when((person) => [
      { match: { the: 'Person/name', of: person.this, is: person.name } },
    ])

    const Manages = Schema.entity({
      employee: Person,
    }).when((manages) => [
      {
        match: {
          the: 'Manages/employee',
          of: manages.this,
          is: manages.employee.this,
        },
      },
    ])

    const Manager = Schema.entity({
      name: String,
      of: Person,
    }).when((manager) => [
      Person({ this: manager.this, name: manager.name }),
      Person(manager.of),
      Manages({ this: manager.this, employee: manager.of }),
    ])

    const db = DB.Memory.create([
      {
        'Person/name': 'Alice',
        'Manages/employee': {
          'Person/name': 'Bob',
          'Manages/employee': { 'Person/name': 'Mallory' },
        },
      },
    ])

    const result = await Manager.match({ of: { name: 'Bob' } }).select({
      from: db,
    })

    assert.deepEqual(result, [
      Manager.new({
        name: 'Alice',
        this: Link.of({
          'Person/name': 'Alice',
          'Manages/employee': {
            'Person/name': 'Bob',
            'Manages/employee': { 'Person/name': 'Mallory' },
          },
        }),
        of: Person.new({
          this: Link.of({
            'Person/name': 'Bob',
            'Manages/employee': { 'Person/name': 'Mallory' },
          }),
          name: 'Bob',
        }),
      }),
    ])
  },

  'schemas and rules are callable': async (assert) => {
    const Text = Schema.string()
    const Point = Schema.entity({
      x: Schema.scalar(),
      y: Schema.scalar(),
    })

    const RawPoint = Point.when((point) => [
      { match: { the: 'Point/x', of: point.this, is: point.x } },
      { match: { the: 'Point/y', of: point.this, is: point.y } },
    ])

    const Invalid = Point.when((point) => [
      RawPoint({
        x: point.x,
        y: point.y,
      }),
      Text(/** @type {DB.Term<string>} */ (point.y)),
    ])

    const result = await Invalid().select({ from: db })

    assert.deepEqual(result, [
      Point.new({
        this: Link.of({ 'Point/x': 0, 'Point/y': '1', v: 2 }),
        x: 0,
        y: '1',
      }),
    ])
  },

  'empty entity schema': async (assert) => {
    const Entity = Schema.entity({})

    const result = await Entity().select({
      from: DB.Memory.create([{ hello: 'world' }, { goodbye: 'everybody' }]),
    })

    assert.deepEqual(result, [
      { this: Link.of({ hello: 'world' }) },
      { this: Link.of({ goodbye: 'everybody' }) },
    ])
  },

  'test fact schema': async (assert) => {
    const name = Schema.fact({
      the: 'Person/name',
      is: String,
    })

    assert.deepEqual(await name.match().select({ from: db }), [
      {
        the: 'Person/name',
        of: { this: Link.of({ 'Person/name': 'Alice' }) },
        is: 'Alice',
      },
      {
        the: 'Person/name',
        of: { this: Link.of({ 'Person/name': 'Bob' }) },
        is: 'Bob',
      },
      {
        the: 'Person/name',
        of: { this: Link.of({ 'Person/name': 'Mallory' }) },
        is: 'Mallory',
      },
    ])

    assert.deepEqual(await name.match({ is: 'Alice' }).select({ from: db }), [
      {
        the: 'Person/name',
        of: { this: Link.of({ 'Person/name': 'Alice' }) },
        is: 'Alice',
      },
    ])
  },
  'compose entities from facts': async (assert) => {
    const name = Schema.fact({ the: 'Person/name', is: String })

    const Person = Schema.entity({
      name,
    })

    const result = await Person().select({ from: db })

    assert.deepEqual(result, [
      {
        name: 'Alice',
        this: Link.of({ 'Person/name': 'Alice' }),
      },
      {
        name: 'Bob',
        this: Link.of({ 'Person/name': 'Bob' }),
      },
      {
        name: 'Mallory',
        this: Link.of({ 'Person/name': 'Mallory' }),
      },
    ])

    assert.deepEqual(await Person({ name: 'Alice' }).select({ from: db }), [
      {
        name: 'Alice',
        this: Link.of({ 'Person/name': 'Alice' }),
      },
    ])
  },

  'composite facts': async (assert) => {
    const name = Schema.fact({ the: 'Person/name', is: String })
    const Person = Schema.entity({
      name,
    })

    const manages = Schema.fact({ the: 'Manages/employee', is: Person })

    const every = await manages().select({ from: DB.Memory.create([alice]) })

    assert.deepEqual(every, [
      {
        the: 'Manages/employee',
        of: { this: Link.of(bob) },
        is: {
          this: Link.of(mallory),
          name: 'Mallory',
        },
      },
      {
        the: 'Manages/employee',
        of: {
          this: Link.of(alice),
        },
        is: {
          this: Link.of(bob),
          name: 'Bob',
        },
      },
    ])

    const some = await manages({
      is: {
        name: 'Bob',
      },
    }).select({ from: DB.Memory.create([alice]) })

    assert.deepEqual(some, [
      {
        the: 'Manages/employee',
        of: {
          this: Link.of(alice),
        },
        is: {
          this: Link.of(bob),
          name: 'Bob',
        },
      },
    ])
  },

  'joins with facts': async (assert) => {
    const db = DB.Memory.create([alice])

    const name = Schema.fact({ the: 'Person/name', is: String })
    const Person = Schema.entity({
      name,
    })

    const manages = Schema.fact({ the: 'Manages/employee', is: Person })

    const Manager = Schema.entity({
      name,
      manages,
    })

    const managers = await Manager().select({ from: db })
    assert.deepEqual(managers, [
      {
        this: Link.of(alice),
        name: 'Alice',
        manages: {
          name: 'Bob',
          this: Link.of(bob),
        },
      },
      {
        this: Link.of(bob),
        name: 'Bob',
        manages: {
          name: 'Mallory',
          this: Link.of(mallory),
        },
      },
    ])
  },

  'define entity with scalars': async (assert) => {
    const name = Schema.fact({ the: 'Person/name', is: Schema.string() })
    const Person = Schema.entity({
      name,
    })

    const result = await Person().select({ from: db })

    assert.deepEqual(result, [
      {
        name: 'Alice',
        this: Link.of({ 'Person/name': 'Alice' }),
      },
      {
        name: 'Bob',
        this: Link.of({ 'Person/name': 'Bob' }),
      },
      {
        name: 'Mallory',
        this: Link.of({ 'Person/name': 'Mallory' }),
      },
    ])
  },

  'literal values': async (assert) => {
    const Name = Schema.fact({
      the: 'Person/name',
      is: 'Alice',
    })

    const result = await Name().select({
      from: DB.Memory.create([alice, bob, mallory]),
    })

    assert.deepEqual(result, [
      {
        the: 'Person/name',
        of: { this: Link.of(alice) },
        is: 'Alice',
      },
    ])
  },

  'attribute schema': async (assert) => {
    const title = Schema.attribute({ the: 'content/title', is: String })
    const hello = { 'article/content': 'Hello, World!' }
    const goodbye = {
      'article/content': 'Goodbye, everybody!',
      'content/title': 'Epilogue',
    }

    assert.deepEqual(
      await title({}).select({
        from: DB.Memory.create([hello, goodbye]),
      }),
      ['Epilogue']
    )
  },

  'implicit attribute use': async (assert) => {
    const title = Schema.attribute({ the: 'content/title', is: String })
    const hello = { 'article/content': 'Hello, World!' }
    const goodbye = {
      'article/content': 'Goodbye, everybody!',
      'content/title': 'Epilogue',
    }
    const implicitTitle = title.implicit('Untitled')

    assert.throws(
      () =>
        Analyzer.plan({
          match: { this: $.this },
          rule: {
            match: { this: $.this },
            // when: [{ not: { match: { of: $.this, the: 'content/title' } } }],
            when: [implicitTitle({ of: $.this })],
          },
        }),
      / Unbound \?of variable referenced from { not: { match: { the: "content\/title", of: \$.of } } }/
    )
  },

  'implicit attribute schema': async (assert) => {
    const title = Schema.attribute({ the: 'content/title', is: String })
    const hello = { 'article/content': 'Hello, World!' }
    const goodbye = {
      'article/content': 'Goodbye, everybody!',
      'content/title': 'Epilogue',
    }
    const implicitTitle = title.implicit('Untitled')

    assert.deepEqual(
      await implicitTitle({
        of: Link.of(hello),
      }).select({
        from: DB.Memory.create([hello, goodbye]),
      }),
      ['Untitled']
    )

    assert.deepEqual(
      await implicitTitle({
        of: Link.of(goodbye),
      }).select({
        from: DB.Memory.create([hello, goodbye]),
      }),
      ['Epilogue']
    )
  },

  'implicit object schema': async (assert) => {
    const MetaData = Schema.entity({
      name: String,
      version: Number,
    })

    const Meta = Schema.attribute({ the: 'meta/data', is: MetaData })
    const ImplicitMeta = Meta.implicit({
      this: Link.of({}),
      name: 'Test',
      version: 2,
    })

    // This is interesting case. Not excludes matches instead of adding new ones
    // however if there was nothing to exclude it will contain implicit bindings.

    const result = await ImplicitMeta({
      of: Link.of({ name: 'test ' }),
    }).select({
      from: DB.Memory.create([
        { name: 'test' },
        // {
        //   'meta/data': {
        //     this: Link.of('explicit'),
        //     name: 'explicit',
        //     version: 1,
        //   },
        // },
      ]),
    })

    assert.deepEqual(result, [
      {
        this: Link.of({}),
        name: 'Test',
        version: 2,
      },
    ])
  },

  'skip define implicit attributes': async (assert) => {
    const title = Schema.fact({
      the: 'content/title',
      is: Schema.string(),
    }).implicit('Untitled')

    const hello = { 'article/content': 'Hello, World!' }
    const goodbye = {
      'article/content': 'Goodbye, everybody!',
      'content/title': 'Epilogue',
    }

    const db = DB.Memory.create([hello, goodbye])

    assert.deepEqual(
      await title.match().select({
        from: db,
      }),
      [
        { the: 'content/title', of: { this: Link.of(hello) }, is: 'Untitled' },
        {
          the: 'content/title',
          of: { this: Link.of(goodbye) },
          is: 'Epilogue',
        },
      ]
    )
  },

  // 'skip entity maps hypothetical': async (assert) => {
  //   const email = Schema.attribute({ Email: { address: String } }).when(
  //     (email) => [
  //       {
  //         match: { text: email, pattern: '*@*.*' },
  //         operator: 'text/like',
  //       },
  //     ]
  //   )

  //   const Email = Schema.value().when(email => [
  //     Schema.string
  //     {
  //       match: { text: email, pattern: '*@*.*' },
  //       operator: 'text/like'
  //     }
  //   ])

  //   const Person = Schema.entity({
  //     name: Schema.string().from("person"),
  //     emain: Schema

  //     Person: { name: String },
  //     Email: {}
  //   })

  //   const AccountID = Schema.for({ domain: {},  })

  //   Schema.string().for({ the: `account/id`, type: Number })

  //   const FirstName = Schema.person.firstName({ type: String })
  //   const LastName = Schema.person.lastName({ type: String })

  //   attribute({ Account: { id: Number } })
  //   const firstName = Schema.attribute({ Person: { firstName: String } })
  //   const lastName = Schema.attribute({ Person: { lastName: String } })

  //   const Account = Schema.entity({
  //     id: Schema.account.id({ type: Number }),
  //     firstName: Schema.person.firstName({ type: String }),
  //     lastName: Schema.person.lastName({ type: String }),
  //     email: Schema.email
  //       .address({ type: String })
  //       .when((email) => [
  //         { match: { text: email, pattern: '*@*.*' }, operator: 'text/like' },
  //       ]),
  //   })
  // },
}
