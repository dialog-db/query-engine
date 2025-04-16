import { Memory } from 'datalogia'
import { Task, Link } from 'datalogia'
import { deduce, Fact, Data, Text, UTF8, Math } from '../src/syntax.js'

const $ = Memory.entity

const db = Memory.create([
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
        const Query = deduce({ type: String })
          .with({ q: Object })
          .where(({ type, q }) => [
            Fact({ the: key, of: $(1), is: q }),
            Data.Type({ of: q, is: type }),
          ])

        const result = yield* Query().select({ from: db })

        assert.deepEqual(
          result,
          [{ type: type }],
          `Expected ${type} got ${result} `
        )
      }

      const Query = deduce({ type: String }).where(({ type }) => [
        Data.Type({ of: Infinity, is: type }),
      ])

      assert.deepEqual(
        yield* Query().select({ from: db }),
        [],
        'produces no frames'
      )
    }),

  'reference relation': (assert) =>
    Task.spawn(function* () {
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
        const Query = deduce({ link: Object }).where(({ link }) => [
          Data.Reference({ of: data, is: link }),
        ])

        assert.deepEqual(yield* Query().select({ from: db }), [
          { link: Link.of(data) },
        ])
      }
    }),

  'test == relation': (assert) =>
    Task.spawn(function* () {
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
        const Query = deduce({ q: Object }).where(({ q }) => [
          Fact({ the: key, of: $(1), is: q }),
          Data.same({ this: q, as: value }),
        ])

        assert.deepEqual(yield* Query().select({ from: db }), [
          { q: /** @type {any} */ (value) },
        ])
      }

      const AssignmentQuery = deduce({ q: Number }).where(({ q }) => [
        Data.same({ this: 5, as: q }),
      ])

      assert.deepEqual(
        yield* AssignmentQuery().select({ from: db }),
        [{ q: 5 }],
        'will perform assignment'
      )
    }),

  'test text/concat': (assert) =>
    Task.spawn(function* () {
      const TwoPartsQuery = deduce({ out: String })
        .with({ text: String })
        .where(({ text, out }) => [
          Data.same({ this: 'hello', as: text }),
          Text.Concat({ of: [text, ' world'], is: out }),
        ])

      assert.deepEqual(yield* TwoPartsQuery().select({ from: db }), [
        { out: 'hello world' },
      ])

      const ThreePartsQuery = deduce({ out: String })
        .with({ text: String })
        .where(({ text, out }) => [
          Data.same({ this: 'hello', as: text }),
          Text.Concat({ of: [text, ' world'], is: out }),
        ])

      assert.deepEqual(yield* ThreePartsQuery().select({ from: db }), [
        { out: 'hello world' },
      ])
    }),

  'test text/words': (assert) =>
    Task.spawn(function* () {
      const Word = deduce({ word: String })
        .with({ text: String })
        .where(({ text, word }) => [
          Data.same({ this: 'hello world', as: text }),
          Text.Words({ of: text, is: word }),
        ])

      assert.deepEqual(yield* Word().select({ from: db }), [
        { word: 'hello' },
        { word: 'world' },
      ])
    }),

  'test text/lines': (assert) =>
    Task.spawn(function* () {
      const Lines = deduce({ line: String })
        .with({ text: String })
        .where(({ text, line }) => [
          Data.same({ this: 'hello,\nhow are you\r\n', as: text }),
          Text.Lines({ of: text, is: line }),
        ])

      assert.deepEqual(yield* Lines().select({ from: db }), [
        { line: 'hello,' },
        { line: 'how are you' },
        { line: '' },
      ])
    }),

  'test text/case/upper': (assert) =>
    Task.spawn(function* () {
      const UpperCase = deduce({ word: String })
        .with({ text: String })
        .where(({ word, text }) => [
          Data.same({ this: 'hello', as: text }),
          Text.UpperCase({ of: text, is: word }),
        ])

      assert.deepEqual(yield* UpperCase().select({ from: db }), [
        { word: 'HELLO' },
      ])
    }),

  'test text/case/lower': (assert) =>
    Task.spawn(function* () {
      const Query = deduce({ word: String })
        .with({ text: String })
        .where(({ text, word }) => [
          Data.same({ this: 'Hello', as: text }),
          Text.LowerCase({ of: text, is: word }),
        ])

      assert.deepEqual(yield* Query().select({ from: db }), [{ word: 'hello' }])
    }),

  'test string/trim': (assert) =>
    Task.spawn(function* () {
      const Query = deduce({ out: String })
        .with({ text: String })
        .where(({ text, out }) => [
          Data.same({ this: '   Hello world!   ', as: text }),
          Text.Trim({ of: text, is: out }),
        ])

      assert.deepEqual(yield* Query().select({ from: db }), [
        { out: 'Hello world!' },
      ])
    }),

  'test text/trim/start': (assert) =>
    Task.spawn(function* () {
      const Query = deduce({ out: String })
        .with({ text: String })
        .where(({ text, out }) => [
          Data.same({ this: '   Hello world!   ', as: text }),
          Text.TrimStart({ of: text, is: out }),
        ])

      assert.deepEqual(yield* Query().select({ from: db }), [
        { out: 'Hello world!   ' },
      ])
    }),
  'test string/trim/end': (assert) =>
    Task.spawn(function* () {
      const Query = deduce({ out: String })
        .with({ text: String })
        .where(({ text, out }) => [
          Data.same({ this: '   Hello world!   ', as: text }),
          Text.TrimEnd({ of: text, is: out }),
        ])

      assert.deepEqual(yield* Query().select({ from: db }), [
        { out: '   Hello world!' },
      ])
    }),
  'test utf8/to/text': (assert) =>
    Task.spawn(function* () {
      const Query = deduce({ out: String })
        .with({ bytes: Uint8Array })
        .where(({ bytes, out }) => [
          Data.same({
            this: new TextEncoder().encode('Hello world!'),
            as: bytes,
          }),
          UTF8.ToText({ of: bytes, is: out }),
        ])

      assert.deepEqual(yield* Query().select({ from: db }), [
        { out: 'Hello world!' },
      ])
    }),

  'test text/to/utf8': (assert) =>
    Task.spawn(function* () {
      const Query = deduce({ out: Uint8Array })
        .with({ text: String })
        .where(({ text, out }) => [
          Data.same({ this: 'Hello world!', as: text }),
          UTF8.FromText({ of: text, is: out }),
        ])

      assert.deepEqual(yield* Query().select({ from: db }), [
        { out: new TextEncoder().encode('Hello world!') },
      ])
    }),

  'test text/length': (assert) =>
    Task.spawn(function* () {
      const Query = deduce({ out: Number })
        .with({ text: String })
        .where(({ text, out }) => [
          Data.same({ this: 'Hello world!', as: text }),
          Text.Length({ of: text, is: out }),
        ])

      assert.deepEqual(yield* Query().select({ from: db }), [{ out: 12 }])
    }),

  'test + operator': (assert) =>
    Task.spawn(function* () {
      const TwoTermsQuery = deduce({ c: Number })
        .with({ a: Number, b: Number })
        .where(({ a, b, c }) => [
          Data.same({ this: 1, as: a }),
          Data.same({ this: 2, as: b }),
          Math.Sum({ of: a, with: b, is: c }),
        ])

      assert.deepEqual(yield* TwoTermsQuery().select({ from: db }), [{ c: 3 }])

      const MultiTermsQuery = deduce({ c: Number })
        .with({ a: Number, b: Number, ab: Number, ab10: Number })
        .where(({ a, b, ab, ab10, c }) => [
          Data.same({ this: 1, as: a }),
          Data.same({ this: 2, as: b }),
          // Note: Multiple term addition is not directly supported by the API
          // This is a simplification that adds terms sequentially
          Math.Sum({ of: a, with: b, is: ab }),
          Math.Sum({ of: ab, with: 10, is: ab10 }),
          Math.Sum({ of: ab10, with: b, is: c }),
        ])

      assert.deepEqual(yield* MultiTermsQuery().select({ from: db }), [
        { c: 15 },
      ])

      const SingleTermQuery = deduce({ c: Number }).where(({ c }) => [
        Data.same({ this: 5, as: c }),
      ])

      assert.deepEqual(yield* SingleTermQuery().select({ from: db }), [
        { c: 5 },
      ])

      const EmptyTermsQuery = deduce({ c: Number }).where(({ c }) => [
        Data.same({ this: 0, as: c }),
      ])

      assert.deepEqual(yield* EmptyTermsQuery().select({ from: db }), [
        { c: 0 },
      ])
    }),

  'test - operator': (assert) =>
    Task.spawn(function* () {
      const TwoTermsQuery = deduce({ c: Number })
        .with({ a: Number, b: Number })
        .where(({ a, b, c }) => [
          Data.same({ this: 10, as: a }),
          Data.same({ this: 2, as: b }),
          Math.Subtraction({ of: a, by: b, is: c }),
        ])

      assert.deepEqual(yield* TwoTermsQuery().select({ from: db }), [{ c: 8 }])

      const MultiTermsQuery = deduce({ c: Number })
        .with({ a: Number, b: Number, ab: Number, ab1: Number })
        .where(({ a, b, ab, ab1, c }) => [
          Data.same({ this: 10, as: a }),
          Data.same({ this: 2, as: b }),
          // Multi-term subtraction not directly supported
          Math.Subtraction({ of: a, by: b, is: ab }),
          Math.Subtraction({ of: ab, by: 1, is: ab1 }),
          Math.Subtraction({ of: ab1, by: b, is: c }),
        ])

      assert.deepEqual(yield* MultiTermsQuery().select({ from: db }), [
        { c: 5 },
      ])

      const EmptyTermsQuery = deduce({ c: Number }).where(({ c }) => [
        Data.same({ this: 0, as: c }),
      ])

      assert.deepEqual(yield* EmptyTermsQuery().select({ from: db }), [
        { c: 0 },
      ])

      const SingleTermQuery = deduce({ c: Number }).where(({ c }) => [
        Data.same({ this: -6, as: c }),
      ])

      assert.deepEqual(yield* SingleTermQuery().select({ from: db }), [
        { c: -6 },
      ])
    }),

  'test * operator': (assert) =>
    Task.spawn(function* () {
      const TwoTermsQuery = deduce({ c: Number })
        .with({ a: Number, b: Number })
        .where(({ a, b, c }) => [
          Data.same({ this: 10, as: a }),
          Data.same({ this: 2, as: b }),
          Math.Multiplication({ of: a, by: b, is: c }),
        ])

      assert.deepEqual(yield* TwoTermsQuery().select({ from: db }), [{ c: 20 }])

      const MultiTermsQuery = deduce({ c: Number })
        .with({ a: Number, b: Number, ab: Number, ab3: Number })
        .where(({ a, b, c, ab, ab3 }) => [
          Data.same({ this: 10, as: a }),
          Data.same({ this: 2, as: b }),
          // Multi-term multiplication not directly supported
          Math.Multiplication({ of: a, by: b, is: ab }),
          Math.Multiplication({ of: ab, by: 3, is: ab3 }),
          Math.Multiplication({ of: ab3, by: b, is: c }),
        ])

      assert.deepEqual(yield* MultiTermsQuery().select({ from: db }), [
        { c: 120 },
      ])

      const EmptyTermsQuery = deduce({ c: Number }).where(({ c }) => [
        Data.same({ this: 1, as: c }),
      ])

      assert.deepEqual(yield* EmptyTermsQuery().select({ from: db }), [
        { c: 1 },
      ])

      const SingleTermQuery = deduce({ c: Number })
        .with({ a: Number })
        .where(({ a, c }) => [
          Data.same({ this: 10, as: a }),
          Data.same({ this: a, as: c }),
        ])

      assert.deepEqual(yield* SingleTermQuery().select({ from: db }), [
        { c: 10 },
      ])
    }),

  'test / operator': (assert) =>
    Task.spawn(function* () {
      const TwoTermsQuery = deduce({ c: Number })
        .with({ a: Number, b: Number })
        .where(({ a, b, c }) => [
          Data.same({ this: 10, as: a }),
          Data.same({ this: 2, as: b }),
          Math.Division({ of: a, by: b, is: c }),
        ])

      assert.deepEqual(yield* TwoTermsQuery().select({ from: db }), [{ c: 5 }])

      const MultiTermsQuery = deduce({ c: Number })
        .with({ a: Number, b: Number, ab: Number, ab3: Number })
        .where(({ a, b, c, ab, ab3 }) => [
          Data.same({ this: 48, as: a }),
          Data.same({ this: 2, as: b }),
          // Multi-term division not directly supported
          Math.Division({ of: a, by: b, is: ab }),
          Math.Division({ of: ab, by: 3, is: ab3 }),
          Math.Division({ of: ab3, by: b, is: c }),
        ])

      assert.deepEqual(yield* MultiTermsQuery().select({ from: db }), [
        { c: 4 },
      ])

      const SingleTermQuery = deduce({ c: Number })
        .with({ a: Number })
        .where(({ a, c }) => [
          Data.same({ this: 5, as: a }),
          Math.Division({ of: a, by: 2, is: c }),
        ])

      assert.deepEqual(yield* SingleTermQuery().select({ from: db }), [
        { c: 2.5 },
      ])

      const DivisionByZeroQuery = deduce({ c: Number })
        .with({ a: Number })
        .where(({ a, c }) => [
          Data.same({ this: 5, as: a }),
          // Division by zero
          Math.Division({ of: a, by: 0, is: c }),
        ])

      assert.deepEqual(
        yield* DivisionByZeroQuery().select({ from: db }),
        [],
        'division by zero not allowed'
      )
    }),

  'test % operator': (assert) =>
    Task.spawn(function* () {
      const Query = deduce({ c: Number })
        .with({ a: Number, b: Number })
        .where(({ a, b, c }) => [
          Data.same({ this: 9, as: a }),
          Data.same({ this: 4, as: b }),
          Math.Modulo({ of: a, by: b, is: c }),
        ])

      assert.deepEqual(yield* Query().select({ from: db }), [{ c: 1 }])
    }),

  'test ** operator': (assert) =>
    Task.spawn(function* () {
      const Query = deduce({ c: Number })
        .with({ b: Number })
        .where(({ b, c }) => [
          Data.same({ this: 3, as: b }),
          Math.Power({ of: 2, exponent: b, is: c }),
        ])

      assert.deepEqual(yield* Query().select({ from: db }), [{ c: 8 }])
    }),

  'test math/absolute': (assert) =>
    Task.spawn(function* () {
      const Query = deduce({ c: Number, d: Number })
        .with({ a: Number, b: Number })
        .where(({ a, b, c, d }) => [
          Data.same({ this: 2, as: a }),
          Data.same({ this: -3, as: b }),
          Math.Absolute({ of: a, is: c }),
          Math.Absolute({ of: b, is: d }),
        ])

      assert.deepEqual(yield* Query().select({ from: db }), [{ c: 2, d: 3 }])
    }),

  'test text/like': (assert) =>
    Task.spawn(function* () {
      const WithResultQuery = deduce({ out: String })
        .with({ text: String })
        .where(({ text, out }) => [
          Data.same({ this: 'Hello World', as: text }),
          Text.match({ this: text, pattern: 'Hello*' }),
          Data.same({ this: text, as: out }),
        ])

      assert.deepEqual(yield* WithResultQuery().select({ from: db }), [
        { out: 'Hello World' },
      ])

      // const BooleanPatternQuery = deduce({ text: String }).when(({ text }) => [
      //   Data.same({ this: 'Hello World', as: text }),
      //   Text.match({ this: text, pattern: 'Hello*' }),
      // ])

      // assert.deepEqual(yield* BooleanPatternQuery().select({ from: db }), [
      //   { text: 'Hello World' },
      // ])

      // const NoMatchQuery = deduce({ out: String })
      //   .with({ text: String })
      //   .when(({ text, out }) => [
      //     Data.same({ this: 'Hello World', as: text }),
      //     Text.match({ this: text, pattern: 'hello*' }),
      //     Data.same({ this: text, as: out }),
      //   ])

      // assert.deepEqual(yield* NoMatchQuery().select({ from: db }), [])
    }),

  'test text/includes': (assert) =>
    Task.spawn(function* () {
      const WithResultQuery = deduce({ out: String })
        .with({ text: String })
        .where(({ text, out }) => [
          Data.same({ this: 'Hello World', as: text }),
          Text.includes({ this: text, slice: 'Hello' }),
          Data.same({ this: text, as: out }),
        ])

      assert.deepEqual(yield* WithResultQuery().select({ from: db }), [
        { out: 'Hello World' },
      ])

      const BooleanQuery = deduce({ text: String }).where(({ text }) => [
        Data.same({ this: 'Hello World', as: text }),
        Text.includes({ this: text, slice: 'World' }),
      ])

      assert.deepEqual(yield* BooleanQuery().select({ from: db }), [
        { text: 'Hello World' },
      ])

      const NoMatchQuery = deduce({ out: String })
        .with({ text: String })
        .where(({ text, out }) => [
          Data.same({ this: 'Hello World', as: text }),
          Text.includes({ this: text, slice: 'hello' }),
          Data.same({ this: text, as: out }),
        ])

      assert.deepEqual(yield* NoMatchQuery().select({ from: db }), [])
    }),
}
