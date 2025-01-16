import * as DB from 'datalogia'
import { Task, Link } from 'datalogia'

const $ = DB.Memory.entity

const db = DB.Memory.create([
  [$(1), 'text', 'hello'],
  [$(1), 'int', 3],
  [$(1), 'bigint', 2n ** 60n],
  [$(1), 'float', 5.2],
  [$(1), 'true', true],
  [$(1), 'false', false],
  [$(1), 'bytes', new Uint8Array([1, 2, 3])],
  [$(1), 'null', null],
  [$(1), 'id', $(1)],
])

/**
 * @type {import('entail').Suite}
 */
export const testRelation = {
  'test type relation': (assert) =>
    Task.spawn(function* () {
      /** @type {DB.Variable<DB.TypeName>} */
      const type = DB.variable()
      const q = DB.variable()
      const expert = /** @type {const} */ ({
        text: 'string',
        int: 'int32',
        bigint: 'int64',
        float: 'float32',
        true: 'boolean',
        false: 'boolean',
        bytes: 'bytes',
        null: 'null',
        id: 'reference',
      })

      for (const [key, type] of Object.entries(expert)) {
        const result = yield* DB.query(db, {
          select: { type },
          where: [
            {
              Case: [$(1), key, q],
            },
            {
              Match: [q, 'data/type', type],
            },
          ],
        })
        assert.deepEqual(
          result,
          [{ type: type }],
          `Expected ${type} got ${result} `
        )
      }

      assert.deepEqual(
        yield* DB.query(db, {
          select: { type },
          where: [
            {
              Match: [Infinity, 'data/type', type],
            },
          ],
        }),
        [],
        'will produce no frames'
      )
    }),

  'test reference relation': (assert) =>
    Task.spawn(function* () {
      const q = DB.link()
      const fixtures = [
        'hello',
        $(1),
        3,
        2n ** 60n,
        5.2,
        true,
        false,
        new Uint8Array([1, 2, 3]),
      ]

      for (const data of fixtures) {
        assert.deepEqual(
          yield* DB.query(db, {
            select: { q },
            where: [
              {
                Match: [data, 'data/refer', q],
              },
            ],
          }),
          [{ q: Link.of(data) }]
        )
      }
    }),

  'test == relation': (assert) =>
    Task.spawn(function* () {
      const type = DB.variable()
      const q = DB.variable()

      const expert = {
        text: 'hello',
        int: 3,
        bigint: 2n ** 60n,
        float: 5.2,
        true: true,
        false: false,
        bytes: new Uint8Array([1, 2, 3]),
        // null: 'null',
        id: $(1),
      }

      for (const [key, value] of Object.entries(expert)) {
        assert.deepEqual(
          yield* DB.query(db, {
            select: { q },
            where: [
              {
                Case: [$(1), key, q],
              },
              {
                Match: [q, '==', value],
              },
            ],
          }),
          [{ q: value }]
        )
      }

      assert.deepEqual(
        yield* DB.query(db, {
          select: { q },
          where: [
            {
              Match: [5, '==', q],
            },
          ],
        }),
        [{ q: 5 }],
        'will perform assignment'
      )
    }),

  'test text/concat': (assert) =>
    Task.spawn(function* () {
      const text = DB.string()
      const out = DB.string()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { out },
          where: [
            {
              Match: ['hello', '==', text],
            },
            {
              Match: [[text, ' world'], 'text/concat', out],
            },
          ],
        }),
        [{ out: 'hello world' }]
      )

      assert.deepEqual(
        yield* DB.query(db, {
          select: { out },
          where: [
            {
              Match: ['hello', '==', text],
            },
            {
              Match: [[text, ' ', 'world'], 'text/concat', out],
            },
          ],
        }),
        [{ out: 'hello world' }]
      )
    }),

  'test text/words': (assert) =>
    Task.spawn(function* () {
      const text = DB.string()
      const word = DB.string()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { word },
          where: [
            {
              Match: ['hello world', '==', text],
            },
            {
              Match: [text, 'text/words', word],
            },
          ],
        }),
        [{ word: 'hello' }, { word: 'world' }]
      )
    }),

  'test text/lines': (assert) =>
    Task.spawn(function* () {
      const text = DB.string()
      const line = DB.string()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { line },
          where: [
            {
              Match: ['hello,\nhow are you\r\n', '==', text],
            },
            {
              Match: [text, 'text/lines', line],
            },
          ],
        }),
        [{ line: 'hello,' }, { line: 'how are you' }, { line: '' }]
      )
    }),

  'test text/case/upper': (assert) =>
    Task.spawn(function* () {
      const text = DB.string()
      const word = DB.string()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { word },
          where: [
            {
              Match: ['hello', '==', text],
            },
            {
              Match: [text, 'text/case/upper', word],
            },
          ],
        }),
        [{ word: 'HELLO' }]
      )
    }),

  'test text/case/lower': (assert) =>
    Task.spawn(function* () {
      const text = DB.string()
      const word = DB.string()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { word },
          where: [
            {
              Match: ['Hello', '==', text],
            },
            {
              Match: [text, 'text/case/lower', word],
            },
          ],
        }),
        [{ word: 'hello' }]
      )
    }),

  'test string/trim': (assert) =>
    Task.spawn(function* () {
      const text = DB.string()
      const out = DB.string()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { out },
          where: [
            {
              Match: ['   Hello world!   ', '==', text],
            },
            {
              Match: [text, 'text/trim', out],
            },
          ],
        }),
        [{ out: 'Hello world!' }]
      )
    }),

  'test text/trim/start': (assert) =>
    Task.spawn(function* () {
      const text = DB.string()
      const out = DB.string()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { out },
          where: [
            {
              Match: ['   Hello world!   ', '==', text],
            },
            {
              Match: [text, 'text/trim/start', out],
            },
          ],
        }),
        [{ out: 'Hello world!   ' }]
      )
    }),
  'test string/trim/end': (assert) =>
    Task.spawn(function* () {
      const text = DB.string()
      const out = DB.string()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { out },
          where: [
            {
              Match: ['   Hello world!   ', '==', text],
            },
            {
              Match: [text, 'text/trim/end', out],
            },
          ],
        }),
        [{ out: '   Hello world!' }]
      )
    }),
  'test utf8/to/text': (assert) =>
    Task.spawn(function* () {
      const bytes = DB.bytes()
      const out = DB.string()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { out },
          where: [
            {
              Match: [new TextEncoder().encode('Hello world!'), '==', bytes],
            },
            {
              Match: [bytes, 'utf8/to/text', out],
            },
          ],
        }),
        [{ out: 'Hello world!' }]
      )
    }),

  'test text/to/utf8': (assert) =>
    Task.spawn(function* () {
      const text = 'Hello world!'
      const out = DB.bytes()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { out },
          where: [
            {
              Match: ['Hello world!', '==', text],
            },
            {
              Match: [text, 'text/to/utf8', out],
            },
          ],
        }),
        [{ out: new TextEncoder().encode('Hello world!') }]
      )
    }),

  'test text/length': (assert) =>
    Task.spawn(function* () {
      const text = DB.string()
      const out = DB.integer()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { out },
          where: [
            {
              Match: ['Hello world!', '==', text],
            },
            {
              Match: [text, 'text/length', out],
            },
          ],
        }),
        [{ out: 12 }]
      )
    }),

  'test + operator': (assert) =>
    Task.spawn(function* () {
      const a = DB.integer()
      const b = DB.integer()
      const c = DB.integer()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { c },
          where: [
            { Match: [1, '==', a] },
            { Match: [2, '==', b] },
            { Match: [[a, b], '+', c] },
          ],
        }),
        [{ c: 3 }]
      )

      assert.deepEqual(
        yield* DB.query(db, {
          select: { c },
          where: [
            { Match: [1, '==', a] },
            { Match: [2, '==', b] },
            { Match: [[a, b, 10, b], '+', c] },
          ],
        }),
        [{ c: 15 }]
      )

      assert.deepEqual(
        yield* DB.query(db, {
          select: { c },
          where: [{ Match: [[5], '+', c] }],
        }),
        [{ c: 5 }]
      )

      assert.deepEqual(
        yield* DB.query(db, {
          select: { c },
          where: [{ Match: [[], '+', c] }],
        }),
        [{ c: 0 }]
      )
    }),

  'test - operator': (assert) =>
    Task.spawn(function* () {
      const a = DB.integer()
      const b = DB.integer()
      const c = DB.integer()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { c },
          where: [
            { Match: [10, '==', a] },
            { Match: [2, '==', b] },
            { Match: [[a, b], '-', c] },
          ],
        }),
        [{ c: 8 }]
      )

      assert.deepEqual(
        yield* DB.query(db, {
          select: { c },
          where: [
            { Match: [10, '==', a] },
            { Match: [2, '==', b] },
            { Match: [[a, b, 1, b], '-', c] },
          ],
        }),
        [{ c: 5 }]
      )

      assert.deepEqual(
        yield* DB.query(db, {
          select: { c },
          where: [{ Match: [[], '-', c] }],
        }),
        [{ c: 0 }]
      )

      assert.deepEqual(
        yield* DB.query(db, {
          select: { c },
          where: [{ Match: [[6], '-', c] }],
        }),
        [{ c: -6 }]
      )
    }),

  'test * operator': (assert) =>
    Task.spawn(function* () {
      const a = DB.integer()
      const b = DB.integer()
      const c = DB.integer()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { c },
          where: [
            { Match: [10, '==', a] },
            { Match: [2, '==', b] },
            { Match: [[a, b], '*', c] },
          ],
        }),
        [{ c: 20 }]
      )

      assert.deepEqual(
        yield* DB.query(db, {
          select: { c },
          where: [
            { Match: [10, '==', a] },
            { Match: [2, '==', b] },
            { Match: [[a, b, 3, b], '*', c] },
          ],
        }),
        [{ c: 120 }]
      )

      assert.deepEqual(
        yield* DB.query(db, {
          select: { c },
          where: [{ Match: [[], '*', c] }],
        }),
        [{ c: 1 }]
      )

      assert.deepEqual(
        yield* DB.query(db, {
          select: { c },
          where: [{ Match: [10, '==', a] }, { Match: [[a], '*', c] }],
        }),
        [{ c: 10 }]
      )
    }),

  'test / operator': (assert) =>
    Task.spawn(function* () {
      const a = DB.integer()
      const b = DB.integer()
      const c = DB.integer()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { c },
          where: [
            { Match: [10, '==', a] },
            { Match: [2, '==', b] },
            { Match: [[a, b], '/', c] },
          ],
        }),
        [{ c: 5 }]
      )

      assert.deepEqual(
        yield* DB.query(db, {
          select: { c },
          where: [
            { Match: [48, '==', a] },
            { Match: [2, '==', b] },
            { Match: [[a, b, 3, b], '/', c] },
          ],
        }),
        [{ c: 4 }]
      )

      assert.deepEqual(
        yield* DB.query(db, {
          select: { c },
          where: [{ Match: [[], '/', c] }],
        }),
        [{ c: 1 }]
      )

      assert.deepEqual(
        yield* DB.query(db, {
          select: { c },
          where: [{ Match: [5, '==', a] }, { Match: [[a], '/', c] }],
        }),
        [{ c: 0.2 }]
      )

      assert.deepEqual(
        yield* DB.query(db, {
          select: { c },
          where: [{ Match: [5, '==', a] }, { Match: [[a, 2, 0], '/', c] }],
        }),
        [],
        'division by zero not allowed'
      )
    }),

  'test % operator': (assert) =>
    Task.spawn(function* () {
      const a = DB.integer()
      const b = DB.integer()
      const c = DB.integer()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { c },
          where: [
            { Match: [9, '==', a] },
            { Match: [4, '==', b] },
            { Match: [{ n: a, by: b }, '%', c] },
          ],
        }),
        [{ c: 1 }]
      )
    }),

  'test ** operator': (assert) =>
    Task.spawn(function* () {
      const a = DB.integer()
      const b = DB.integer()
      const c = DB.integer()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { c },
          where: [
            { Match: [2, '==', a] },
            { Match: [3, '==', b] },
            { Match: [{ of: 2, by: b }, '**', c] },
          ],
        }),
        [{ c: 8 }]
      )
    }),

  'test math/absolute': (assert) =>
    Task.spawn(function* () {
      const a = DB.integer()
      const b = DB.integer()
      const c = DB.integer()
      const d = DB.integer()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { c, d },
          where: [
            { Match: [2, '==', a] },
            { Match: [-3, '==', b] },
            { Match: [a, 'math/absolute', c] },
            { Match: [b, 'math/absolute', d] },
          ],
        }),
        [{ c: 2, d: 3 }]
      )
    }),

  'test text/like': (assert) =>
    Task.spawn(function* () {
      const text = DB.string()
      const out = DB.string()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { out },
          where: [
            {
              Match: ['Hello World', '==', text],
            },
            {
              Match: [{ text, pattern: 'Hello*' }, 'text/like', out],
            },
          ],
        }),
        [{ out: 'Hello World' }]
      )

      assert.deepEqual(
        yield* DB.query(db, {
          select: { text },
          where: [
            {
              Match: ['Hello World', '==', text],
            },
            {
              Match: [{ text, pattern: 'Hello*' }, 'text/like'],
            },
          ],
        }),
        [{ text: 'Hello World' }]
      )

      assert.deepEqual(
        yield* DB.query(db, {
          select: { out },
          where: [
            {
              Match: ['Hello World', '==', text],
            },
            {
              Match: [{ text, pattern: 'hello*' }, 'text/like', out],
            },
          ],
        }),
        []
      )
    }),

  'test text/includes': (assert) =>
    Task.spawn(function* () {
      const text = DB.string()
      const out = DB.string()
      assert.deepEqual(
        yield* DB.query(db, {
          select: { out },
          where: [
            {
              Match: ['Hello World', '==', text],
            },
            {
              Match: [{ text, slice: 'Hello' }, 'text/includes', out],
            },
          ],
        }),
        [{ out: 'Hello World' }]
      )

      assert.deepEqual(
        yield* DB.query(db, {
          select: { text },
          where: [
            {
              Match: ['Hello World', '==', text],
            },
            {
              Match: [{ text, slice: 'World' }, 'text/includes'],
            },
          ],
        }),
        [{ text: 'Hello World' }]
      )

      assert.deepEqual(
        yield* DB.query(db, {
          select: { out },
          where: [
            {
              Match: ['Hello World', '==', text],
            },
            {
              Match: [{ text, slice: 'hello' }, 'text/includes', out],
            },
          ],
        }),
        []
      )
    }),
}
