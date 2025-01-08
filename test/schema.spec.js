import * as DB from 'datalogia'
import * as Analyzer from '../src/analyzer.js'
import * as Schema from '../src/schema.js'
import { $, Task } from 'datalogia'
import * as Link from '../src/link.js'

const db = DB.Memory.create([
  {
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
  },
])

/**
 * @type {import('entail').Suite}
 */
export const testSchema = {
  'test schema': async (assert) => {
    const Point = Schema.entity(
      {
        x: Number,
        y: Number,
      },
      'Point'
    )

    const result = await Point({ x: 0 }).select({
      from: db,
    })

    assert.deepEqual(result, [
      Point.new({
        x: 0,
        y: 0,
        this: Link.of({ 'Point/x': 0, 'Point/y': 0, v: 0 }),
      }),
    ])
  },

  'nested entities with namespace': async (assert) => {
    const Point = Schema.entity(
      {
        x: Number,
        y: Number,
      },
      'Point'
    )

    const Line = Schema.entity(
      {
        a: Point,
        b: Point,
      },
      'Line'
    )

    const result = await Line().select({
      from: db,
    })

    assert.deepEqual(result, [
      Line.new({
        a: Point.new({
          this: Link.of({ 'Point/x': 1, 'Point/y': 0 }),
          x: 1,
          y: 0,
        }),
        b: Point.new({
          this: Link.of({ 'Point/x': 10, 'Point/y': 12 }),
          x: 10,
          y: 12,
        }),
        this: Link.of({
          'Line/a': { 'Point/x': 1, 'Point/y': 0 },
          'Line/b': { 'Point/x': 10, 'Point/y': 12 },
        }),
      }),
      Line.new({
        a: Point.new({
          this: Link.of({ 'Point/x': 1, 'Point/y': 10 }),
          x: 1,
          y: 10,
        }),
        b: Point.new({
          this: Link.of({ 'Point/x': 10, 'Point/y': 2 }),
          x: 10,
          y: 2,
        }),
        this: Link.of({
          'Line/a': { 'Point/x': 1, 'Point/y': 10 },
          'Line/b': { 'Point/x': 10, 'Point/y': 2 },
        }),
      }),
    ])
  },

  'can do a nested selection': async (assert) => {
    const Point = Schema.entity(
      {
        x: Number,
        y: Number,
      },
      'Point'
    )

    const Line = Schema.entity(
      {
        a: Point,
        b: Point,
      },
      'Line'
    )

    const result = await Line({ b: { y: 2 } }).select({ from: db })

    assert.deepEqual(result, [
      Line.new({
        a: Point.new({
          this: Link.of({ 'Point/x': 1, 'Point/y': 10 }),
          x: 1,
          y: 10,
        }),
        b: Point.new({
          this: Link.of({ 'Point/x': 10, 'Point/y': 2 }),
          x: 10,
          y: 2,
        }),
        this: Link.of({
          'Line/a': { 'Point/x': 1, 'Point/y': 10 },
          'Line/b': { 'Point/x': 10, 'Point/y': 2 },
        }),
      }),
    ])
  },

  'define rule from schema': async (assert) => {
    const Cursor = Schema.entity(
      {
        top: Number,
        left: Number,
      },
      'Cursor'
    ).when(($) => [
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
    const Point = Schema.entity(
      {
        x: Number,
        y: Number,
      },
      'Point'
    )

    const NonZeroPoint = Point.when((point) => [
      Point(point),
      Point.not({ this: point.this, x: 0, y: 0 }),
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
    const Person = Schema.entity(
      {
        name: String,
      },
      'Person'
    )

    const Manages = Schema.entity(
      {
        employee: Person,
      },
      'Manages'
    )

    const Manager = Schema.entity(
      {
        name: String,
        of: Person,
      },
      'Manager'
    ).when((manager) => [
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
    const Point = Schema.entity(
      {
        x: {},
        y: {},
      },
      'Point'
    )

    const Invalid = Point.when((point) => [Point(point), Text(point.y)])

    const result = await Invalid().select({ from: db })

    assert.deepEqual(result, [
      Point.new({
        this: Link.of({ 'Point/x': 0, 'Point/y': '1', v: 2 }),
        x: 0,
        y: '1',
      }),
    ])
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
