import {
  fact,
  same,
  Collection,
  Memory,
  Task,
  Link,
  Text,
  UTF8,
  Math,
  Data,
  $,
} from './lib.js'

const refer = Memory.entity

const db = Memory.create([
  { of: refer(1), the: 'type/text', is: 'hello' },
  { of: refer(1), the: 'type/int', is: 3 },
  { of: refer(1), the: 'type/bigint', is: 2n ** 60n },
  { of: refer(1), the: 'type/float', is: 5.2 },
  { of: refer(1), the: 'type/true', is: true },
  { of: refer(1), the: 'type/false', is: false },
  { of: refer(1), the: 'type/bytes', is: new Uint8Array([1, 2, 3]) },
  { of: refer(1), the: 'type/null', is: null },
  { of: refer(1), the: 'type/id', is: refer(1) },
])

/**
 * @type {import('entail').Suite}
 */
export const testRelation = {
  'test type relation': (assert) =>
    Task.spawn(function* () {
      const expert = /** @type {const} */ ({
        'type/text': 'string',
        'type/int': 'integer',
        'type/bigint': 'bigint',
        'type/float': 'float',
        'type/true': 'boolean',
        'type/false': 'boolean',
        'type/bytes': 'bytes',
        'type/null': 'null',
        'type/id': 'reference',
      })

      for (const [key, type] of Object.entries(expert)) {
        const Type = fact({ type: String })
          .with({ q: Object })
          .where(({ type, q }) => [
            Collection({ this: refer(1), at: key, of: q }),
            // match({ the: key, of: refer(1), is: q }),
            Data.Type({ of: q, is: type }),
            Type.claim({ type }),
          ])

        const result = yield* Type().query({ from: db })

        assert.deepEqual(
          result,
          [Type.assert({ type: type })],
          `Expected ${type} got ${result} `
        )
      }

      const Query = fact({ type: String }).where(({ type }) => [
        Data.Type({ of: Infinity, is: type }),
        Query.claim({ type }),
      ])

      assert.deepEqual(
        yield* Query().query({ from: db }),
        [],
        'produces no frames'
      )
    }),

  'reference relation': (assert) =>
    Task.spawn(function* () {
      const fixtures = [
        'hello',
        refer(1),
        3,
        2n ** 60n,
        5.2,
        true,
        false,
        new Uint8Array([1, 2, 3]),
      ]

      for (const data of fixtures) {
        const Target = fact({ link: Object }).where(({ link }) => [
          Data.Reference({ of: data, is: link }),
          Target.claim({ link }),
        ])

        assert.deepEqual(yield* Target().query({ from: db }), [
          Target.assert({ link: Link.of(data) }),
        ])
      }
    }),

  'test == relation': (assert) =>
    Task.spawn(function* () {
      const expert = {
        'type/text': 'hello',
        'type/int': 3,
        'type/bigint': 2n ** 60n,
        'type/float': 5.2,
        'type/true': true,
        'type/false': false,
        'type/bytes': new Uint8Array([1, 2, 3]),
        // 'type/null': 'null',
        'type/id': refer(1),
      }

      for (const [key, value] of Object.entries(expert)) {
        const Query = fact({ q: Object }).where(({ q }) => [
          Collection({ this: refer(1), at: key, of: q }),
          Data.same({ this: q, as: value }),
          Query.claim({ q }),
        ])

        assert.deepEqual(yield* Query().query({ from: db }), [
          Query.assert({ q: /** @type {any} */ (value) }),
        ])
      }

      const AssignmentQuery = fact({ q: Number }).where(({ q }) => [
        Data.same({ this: 5, as: q }),
        AssignmentQuery.claim({ q }),
      ])

      assert.deepEqual(
        yield* AssignmentQuery().query({ from: db }),
        [AssignmentQuery.assert({ q: 5 })],
        'will perform assignment'
      )
    }),

  'test text/concat': (assert) =>
    Task.spawn(function* () {
      const TwoPartsQuery = fact({ out: String })
        .with({ text: String })
        .where(({ text, out }) => [
          Data.same({ this: 'hello', as: text }),
          Text.Concat({ of: [text, ' world'], is: out }),
          TwoPartsQuery.claim({ out }),
        ])

      assert.deepEqual(yield* TwoPartsQuery().query({ from: db }), [
        TwoPartsQuery.assert({ out: 'hello world' }),
      ])

      const ThreePartsQuery = fact({ out: String })
        .with({ text: String })
        .where(({ text, out }) => [
          Data.same({ this: 'hello', as: text }),
          Text.Concat({ of: [text, ' world'], is: out }),
          ThreePartsQuery.claim({ out }),
        ])

      assert.deepEqual(yield* ThreePartsQuery().query({ from: db }), [
        ThreePartsQuery.assert({ out: 'hello world' }),
      ])
    }),

  'test text/words': (assert) =>
    Task.spawn(function* () {
      const Word = fact({ word: String })
        .with({ text: String })
        .where(({ text, word }) => [
          Data.same({ this: 'hello world', as: text }),
          Text.Words({ of: text, is: word }),
          Word.claim({ word }),
        ])

      assert.deepEqual(yield* Word().query({ from: db }), [
        Word.assert({ word: 'hello' }),
        Word.assert({ word: 'world' }),
      ])
    }),

  'test text/lines': (assert) =>
    Task.spawn(function* () {
      const Line = fact({ content: String })
        .with({ text: String })
        .where(({ text, content }) => [
          Data.same({ this: 'hello,\nhow are you\r\n', as: text }),
          Text.Lines({ of: text, is: content }),
          Line.claim({ content }),
        ])

      assert.deepEqual(yield* Line().query({ from: db }), [
        Line.assert({ content: 'hello,' }),
        Line.assert({ content: 'how are you' }),
        Line.assert({ content: '' }),
      ])
    }),

  'test text/case/upper': (assert) =>
    Task.spawn(function* () {
      const UpperCase = fact({ word: String })
        .with({ text: String })
        .where(({ word, text }) => [
          Data.same({ this: 'hello', as: text }),
          Text.UpperCase({ of: text, is: word }),
          UpperCase.claim({ word }),
        ])

      assert.deepEqual(yield* UpperCase().query({ from: db }), [
        UpperCase.assert({ word: 'HELLO' }),
      ])
    }),

  'test text/case/lower': (assert) =>
    Task.spawn(function* () {
      const LowerCase = fact({ word: String })
        .with({ text: String })
        .where(({ text, word }) => [
          Data.same({ this: 'Hello', as: text }),
          Text.LowerCase({ of: text, is: word }),
          LowerCase.claim({ word }),
        ])

      assert.deepEqual(yield* LowerCase().query({ from: db }), [
        LowerCase.assert({ word: 'hello' }),
      ])
    }),

  'test string/trim': (assert) =>
    Task.spawn(function* () {
      const Trim = fact({ text: String })
        .with({ source: String })
        .where(({ text, source }) => [
          Data.same({ this: '   Hello world!   ', as: source }),
          Text.Trim({ of: source, is: text }),
          Trim.claim({ text }),
        ])

      assert.deepEqual(yield* Trim().query({ from: db }), [
        Trim.assert({ text: 'Hello world!' }),
      ])
    }),

  'test text/trim/start': (assert) =>
    Task.spawn(function* () {
      const TrimStart = fact({ text: String })
        .with({ source: String })
        .where(({ source, text }) => [
          Data.same({ this: '   Hello world!   ', as: source }),
          Text.TrimStart({ of: source, is: text }),
          TrimStart.claim({ text }),
        ])

      assert.deepEqual(yield* TrimStart().query({ from: db }), [
        TrimStart.assert({ text: 'Hello world!   ' }),
      ])
    }),
  'test string/trim/end': (assert) =>
    Task.spawn(function* () {
      const TrimEnd = fact({ text: String })
        .with({ source: String })
        .where(({ text, source }) => [
          Data.same({ this: '   Hello world!   ', as: source }),
          Text.TrimEnd({ of: source, is: text }),
          TrimEnd.claim({ text }),
        ])

      assert.deepEqual(yield* TrimEnd().query({ from: db }), [
        TrimEnd.assert({ text: '   Hello world!' }),
      ])
    }),
  'test utf8/to/text': (assert) =>
    Task.spawn(function* () {
      const Text = fact({ content: String })
        .with({ bytes: Uint8Array })
        .where(({ bytes, content }) => [
          Data.same({
            this: new TextEncoder().encode('Hello world!'),
            as: bytes,
          }),
          UTF8.ToText({ of: bytes, is: content }),
          Text.claim({ content }),
        ])

      assert.deepEqual(yield* Text().query({ from: db }), [
        Text.assert({ content: 'Hello world!' }),
      ])
    }),

  'test text/to/utf8': (assert) =>
    Task.spawn(function* () {
      const Bytes = fact({ content: Uint8Array })
        .with({ text: String })
        .where(({ text, content }) => [
          Data.same({ this: 'Hello world!', as: text }),
          UTF8.FromText({ of: text, is: content }),
          Bytes.claim({ content }),
        ])

      assert.deepEqual(yield* Bytes().query({ from: db }), [
        Bytes.assert({ content: new TextEncoder().encode('Hello world!') }),
      ])
    }),

  'test text/length': (assert) =>
    Task.spawn(function* () {
      const Info = fact({ length: Number })
        .with({ text: String })
        .where(({ text, length }) => [
          Data.same({ this: 'Hello world!', as: text }),
          Text.Length({ of: text, is: length }),
          Info.claim({ length }),
        ])

      assert.deepEqual(yield* Info().query({ from: db }), [
        Info.assert({ length: 12 }),
      ])
    }),

  'test + operator': (assert) =>
    Task.spawn(function* () {
      const Count = fact({ c: Number })
        .with({ a: Number, b: Number })
        .where(({ a, b, c }) => [
          same({ this: a, as: 1 }),
          same({ this: b, as: 2 }),
          Math.Sum({ of: a, with: b, is: c }),
          Count.claim({ c }),
        ])

      assert.deepEqual(yield* Count().query({ from: db }), [
        Count.assert({ c: 3 }),
      ])

      const Compute = fact({ c: Number })
        .with({ a: Number, b: Number, ab: Number, ab10: Number })
        .where(({ a, b, ab, ab10, c }) => [
          same({ this: a, as: 1 }),
          same({ this: 2, as: b }),
          // Note: Multiple term addition is not directly supported by the API
          // This is a simplification that adds terms sequentially
          Math.Sum({ of: a, with: b, is: ab }),
          Math.Sum({ of: ab, with: 10, is: ab10 }),
          Math.Sum({ of: ab10, with: b, is: c }),
          Compute.claim({ c }),
        ])

      assert.deepEqual(yield* Compute().query({ from: db }), [
        Compute.assert({ c: 15 }),
      ])

      const Five = fact({ c: Number }).where(({ c }) => [
        same({ this: c, as: 5 }),
        Five.claim({ c }),
      ])

      assert.deepEqual(yield* Five().query({ from: db }), [
        Five.assert({ c: 5 }),
      ])
    }),

  'test - operator': (assert) =>
    Task.spawn(function* () {
      const TwoTermsSubtract = fact({ c: Number })
        .with({ a: Number, b: Number })
        .where(({ a, b, c }) => [
          Data.same({ this: 10, as: a }),
          Data.same({ this: 2, as: b }),
          Math.Subtraction({ of: a, by: b, is: c }),
          TwoTermsSubtract.claim({ c }),
        ])

      assert.deepEqual(yield* TwoTermsSubtract().query({ from: db }), [
        TwoTermsSubtract.assert({ c: 8 }),
      ])

      const MultiTermsSubtract = fact({ c: Number })
        .with({ a: Number, b: Number, ab: Number, ab1: Number })
        .where(({ a, b, ab, ab1, c }) => [
          Data.same({ this: 10, as: a }),
          Data.same({ this: 2, as: b }),
          // Multi-term subtraction not directly supported
          Math.Subtraction({ of: a, by: b, is: ab }),
          Math.Subtraction({ of: ab, by: 1, is: ab1 }),
          Math.Subtraction({ of: ab1, by: b, is: c }),
          MultiTermsSubtract.claim({ c }),
        ])

      assert.deepEqual(yield* MultiTermsSubtract().query({ from: db }), [
        MultiTermsSubtract.assert({ c: 5 }),
      ])
    }),

  'test * operator': (assert) =>
    Task.spawn(function* () {
      const TwoTermsQuery = fact({ c: Number })
        .with({ a: Number, b: Number })
        .where(({ a, b, c }) => [
          Data.same({ this: 10, as: a }),
          Data.same({ this: 2, as: b }),
          Math.Multiplication({ of: a, by: b, is: c }),
          TwoTermsQuery.claim({ c }),
        ])

      assert.deepEqual(yield* TwoTermsQuery().query({ from: db }), [
        TwoTermsQuery.assert({ c: 20 }),
      ])

      const MultiTermsQuery = fact({ c: Number })
        .with({ a: Number, b: Number, ab: Number, ab3: Number })
        .where(({ a, b, c, ab, ab3 }) => [
          Data.same({ this: 10, as: a }),
          Data.same({ this: 2, as: b }),
          // Multi-term multiplication not directly supported
          Math.Multiplication({ of: a, by: b, is: ab }),
          Math.Multiplication({ of: ab, by: 3, is: ab3 }),
          Math.Multiplication({ of: ab3, by: b, is: c }),
          MultiTermsQuery.claim({ c }),
        ])

      assert.deepEqual(yield* MultiTermsQuery().query({ from: db }), [
        MultiTermsQuery.assert({ c: 120 }),
      ])
    }),

  'test / operator': (assert) =>
    Task.spawn(function* () {
      const TwoTermsQuery = fact({ c: Number })
        .with({ a: Number, b: Number })
        .where(({ a, b, c }) => [
          Data.same({ this: 10, as: a }),
          Data.same({ this: 2, as: b }),
          Math.Division({ of: a, by: b, is: c }),
          TwoTermsQuery.claim({ c }),
        ])

      assert.deepEqual(yield* TwoTermsQuery().query({ from: db }), [
        TwoTermsQuery.assert({ c: 5 }),
      ])

      const MultiTermsQuery = fact({ c: Number })
        .with({ a: Number, b: Number, ab: Number, ab3: Number })
        .where(({ a, b, c, ab, ab3 }) => [
          Data.same({ this: 48, as: a }),
          Data.same({ this: 2, as: b }),
          // Multi-term division not directly supported
          Math.Division({ of: a, by: b, is: ab }),
          Math.Division({ of: ab, by: 3, is: ab3 }),
          Math.Division({ of: ab3, by: b, is: c }),
          MultiTermsQuery.claim({ c }),
        ])

      assert.deepEqual(yield* MultiTermsQuery().query({ from: db }), [
        MultiTermsQuery.assert({ c: 4 }),
      ])

      const SingleTermQuery = fact({ c: Number })
        .with({ a: Number })
        .where(({ a, c }) => [
          Data.same({ this: 5, as: a }),
          Math.Division({ of: a, by: 2, is: c }),
          SingleTermQuery.claim({ c }),
        ])

      assert.deepEqual(yield* SingleTermQuery().query({ from: db }), [
        SingleTermQuery.assert({ c: 2.5 }),
      ])

      const DivisionByZeroQuery = fact({ c: Number })
        .with({ a: Number })
        .where(({ a, c }) => [
          Data.same({ this: 5, as: a }),
          // Division by zero
          Math.Division({ of: a, by: 0, is: c }),
          DivisionByZeroQuery.claim({ c }),
        ])

      assert.deepEqual(
        yield* DivisionByZeroQuery().query({ from: db }),
        [],
        'division by zero not allowed'
      )
    }),

  'test % operator': (assert) =>
    Task.spawn(function* () {
      const Query = fact({ c: Number })
        .with({ a: Number, b: Number })
        .where(({ a, b, c }) => [
          Data.same({ this: 9, as: a }),
          Data.same({ this: 4, as: b }),
          Math.Modulo({ of: a, by: b, is: c }),
          Query.claim({ c }),
        ])

      assert.deepEqual(yield* Query().query({ from: db }), [
        Query.assert({ c: 1 }),
      ])
    }),

  'test ** operator': (assert) =>
    Task.spawn(function* () {
      const Query = fact({ c: Number })
        .with({ b: Number })
        .where(({ b, c }) => [
          Data.same({ this: 3, as: b }),
          Math.Power({ of: 2, exponent: b, is: c }),
          Query.claim({ c }),
        ])

      assert.deepEqual(yield* Query().query({ from: db }), [
        Query.assert({ c: 8 }),
      ])
    }),

  'test math/absolute': (assert) =>
    Task.spawn(function* () {
      const Query = fact({ c: Number, d: Number })
        .with({ a: Number, b: Number })
        .where(({ a, b, c, d }) => [
          Data.same({ this: 2, as: a }),
          Data.same({ this: -3, as: b }),
          Math.Absolute({ of: a, is: c }),
          Math.Absolute({ of: b, is: d }),
          Query.claim({ c, d }),
        ])

      assert.deepEqual(yield* Query().query({ from: db }), [
        Query.assert({ c: 2, d: 3 }),
      ])
    }),

  'test text/like': (assert) =>
    Task.spawn(function* () {
      const WithResultQuery = fact({ out: String })
        .with({ text: String })
        .where(({ text, out }) => [
          Data.same({ this: 'Hello World', as: text }),
          Text.match({ this: text, pattern: 'Hello*' }),
          Data.same({ this: text, as: out }),
          WithResultQuery.claim({ out }),
        ])

      assert.deepEqual(yield* WithResultQuery().query({ from: db }), [
        WithResultQuery.assert({ out: 'Hello World' }),
      ])

      const BooleanPatternQuery = fact({ text: String }).where(({ text }) => [
        Data.same({ this: 'Hello World', as: text }),
        Text.match({ this: text, pattern: 'Hello*' }),
        BooleanPatternQuery.claim({ text }),
      ])

      assert.deepEqual(yield* BooleanPatternQuery().query({ from: db }), [
        BooleanPatternQuery.assert({ text: 'Hello World' }),
      ])

      const NoMatchQuery = fact({ out: String })
        .with({ text: String })
        .where(({ text, out }) => [
          Data.same({ this: 'Hello World', as: text }),
          Text.match({ this: text, pattern: 'hello*' }),
          Data.same({ this: text, as: out }),
          NoMatchQuery.claim({ out }),
        ])

      assert.deepEqual(yield* NoMatchQuery().query({ from: db }), [])
    }),

  'test text/includes': (assert) =>
    Task.spawn(function* () {
      const WithResultQuery = fact({ out: String })
        .with({ text: String })
        .where(({ text, out }) => [
          Data.same({ this: 'Hello World', as: text }),
          Text.includes({ this: text, slice: 'Hello' }),
          Data.same({ this: text, as: out }),
          WithResultQuery.claim({ out }),
        ])

      assert.deepEqual(yield* WithResultQuery().query({ from: db }), [
        WithResultQuery.assert({ out: 'Hello World' }),
      ])

      const BooleanQuery = fact({ text: String }).where(({ text }) => [
        Data.same({ this: 'Hello World', as: text }),
        Text.includes({ this: text, slice: 'World' }),
        BooleanQuery.claim({ text }),
      ])

      assert.deepEqual(yield* BooleanQuery().query({ from: db }), [
        BooleanQuery.assert({ text: 'Hello World' }),
      ])

      const NoMatchQuery = fact({ out: String })
        .with({ text: String })
        .where(({ text, out }) => [
          Data.same({ this: 'Hello World', as: text }),
          Text.includes({ this: text, slice: 'hello' }),
          Data.same({ this: text, as: out }),
          NoMatchQuery.claim({ out }),
        ])

      assert.deepEqual(yield* NoMatchQuery().query({ from: db }), [])
    }),

  'test reference group': async (assert) => {
    const Test = fact({ out: Object, a: String, b: String }).where(
      ({ a, b, out }) => [
        Data.same({ this: 'world', as: b }),
        Data.Reference({ is: out, of: { a, b } }),
        Test.claim({ out, a, b }),
      ]
    )

    assert.deepEqual(
      await Test.match({ a: 'hello', b: $.b, out: $.q }).query({
        from: db,
      }),
      [
        Test.assert({
          a: 'hello',
          b: 'world',
          out: Link.of({ a: 'hello', b: 'world' }),
        }),
      ]
    )
  },
  'test fact': async (assert) => {
    const Test = fact({ out: Object, a: String, b: String }).where(
      ({ a, b, out }) => [
        Data.same({ this: 'world', as: b }),
        Data.Fact({ this: out, a, b }),
        Test.claim({ a, b, out }),
      ]
    )

    assert.deepEqual(
      await Test.match({ a: 'hello' }).query({
        from: db,
      }),
      [
        Test.assert({
          a: 'hello',
          b: 'world',
          out: Link.of({ a: 'hello', b: 'world' }),
        }),
      ]
    )
  },
}
