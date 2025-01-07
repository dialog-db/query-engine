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
    const Point = Schema.schema({
      Point: {
        x: Number,
        y: Number,
      },
    })

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
    const Point = Schema.schema({
      Point: {
        x: Number,
        y: Number,
      },
    })

    const Line = Schema.schema({
      Line: {
        a: Point,
        b: Point,
      },
    })

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
    const Point = Schema.schema({
      Point: {
        x: Number,
        y: Number,
      },
    })

    const Line = Schema.schema({
      Line: {
        a: Point,
        b: Point,
      },
    })

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
    const Cursor = Schema.schema({
      Cursor: {
        top: Number,
        left: Number,
      },
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
}
