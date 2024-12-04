import { ByteView, Link as IPLDLink } from 'multiformats'
import { Task } from './task.js'

export type { ByteView, Task }

/**
 * Generic reader interface that can be used to read `O` value form the
 * input `I` value. Reader may fail and error is denoted by `X` type.
 *
 * @template O - The output type of this reader
 * @template I - The input type of this reader.
 * @template X - The error type denotes failure reader may produce.
 */
export interface TryFrom<
  Type extends {
    Self: unknown
    Input: unknown
  },
> {
  tryFrom: (input: Type['Input']) => Result<Type['Self'], Error>
}

/**
 * Defines result type as per invocation spec
 *
 * @see https://github.com/ucan-wg/invocation/#6-result
 */

export type Result<T = unknown, X extends {} = {}> = Variant<{
  ok: T
  error: X
}>

/**
 * Utility type for defining a [keyed union] type as in IPLD Schema. In practice
 * this just works around typescript limitation that requires discriminant field
 * on all variants.
 *
 * ```ts
 * type Result<T, X> =
 *   | { ok: T }
 *   | { error: X }
 *
 * const demo = (result: Result<string, Error>) => {
 *   if (result.ok) {
 *   //  ^^^^^^^^^ Property 'ok' does not exist on type '{ error: Error; }`
 *   }
 * }
 * ```
 *
 * Using `Variant` type we can define same union type that works as expected:
 *
 * ```ts
 * type Result<T, X> = Variant<{
 *   ok: T
 *   error: X
 * }>
 *
 * const demo = (result: Result<string, Error>) => {
 *   if (result.ok) {
 *     result.ok.toUpperCase()
 *   }
 * }
 * ```
 *
 * [keyed union]:https://ipld.io/docs/schemas/features/representation-strategies/#union-keyed-representation
 */
export type Variant<U extends Record<string, unknown>> = {
  [Key in keyof U]: { [K in Exclude<keyof U, Key>]?: never } & {
    [K in Key]: U[Key]
  }
}[keyof U]

export type Tagged<T> = {
  [Case in keyof T]: Exclude<keyof T, Case> extends never
    ? T
    : InferenceError<'It may only contain one key'>
}[keyof T]

/**
 * Utility type for including type errors in the typescript checking. It
 * defines impossible type (object with non-existent unique symbol field).
 * This type can be used in cases where typically `never` is used, but
 * where some error message would be useful.
 */
interface InferenceError<message> {
  [Marker]: never & message
}

export declare const Marker: unique symbol

/**
 * A utility type to retain an unused type parameter `T`.
 * Similar to [phantom type parameters in Rust](https://doc.rust-lang.org/rust-by-example/generics/phantom.html).
 *
 * Capturing unused type parameters allows us to define "nominal types," which
 * TypeScript does not natively support. Nominal types in turn allow us to capture
 * semantics not represented in the actual type structure, without requiring us to define
 * new classes or pay additional runtime costs.
 *
 * For a concrete example, see {@link ByteView}, which extends the `Uint8Array` type to capture
 * type information about the structure of the data encoded into the array.
 */
export interface Phantom<T> {
  // This field can not be represented because field name is non-existent
  // unique symbol. But given that field is optional any object will valid
  // type constraint.
  [Marker]?: T
}

export type New<T, Type = Tagged<T>> = Tagged<T>[keyof Tagged<T>] &
  Phantom<Type>

/**
 * Type representing a unit value.
 */
export interface Unit {}

/**
 * Signed 32-bit integer type.
 */
export type Int32 = New<{ Int32: number }>
/**
 * Signed 64-bit integer type.
 */
export type Int64 = New<{ Int64: bigint }>
/**
 * 32-bit floating point number type.
 */
export type Float32 = New<{ Float32: number }>

/**
 * Type representing a raw bytes.
 */
export type Bytes = Uint8Array

export type Null = null

/**
 * Type representing an IPLD link.
 */
export interface Link<
  Data extends {} | null = {} | null,
  Format extends number = number,
  Alg extends number = number,
> {
  ['/']: ByteView<this>
}

/**
 * All the constants in the system represented as a union of the following types.
 *
 * We are likely to introduce uint32, int8, uint8 and etc but for now we have
 * chosen to keep things simple.
 */
export type Constant =
  | null
  | boolean
  | Int32
  | Float32
  | Int64
  | string
  | Bytes
  | Link

/**
 * Supported primitive types. Definition utilizes `Phantom` type to describe
 * the type for compile type inference and `Variant` type to describe it for
 * the runtime inference.
 */
export type Type<T extends Constant = Constant> = Phantom<T> &
  Variant<{
    Boolean: Unit
    Int32: Unit
    Int64: Unit
    Float32: Unit
    String: Unit
    Bytes: Unit
    Link: Unit
    Null: Unit
  }>

// /**
//  * Variable is placeholder for a value that will be matched against by the
//  * query engine. It is represented as an abstract `Reader` that will attempt
//  * to read arbitrary {@type Data} and return result with either `ok` of the
//  * `Type` or an `error`.
//  *
//  * Variables will be assigned unique `bindingKey` by a query engine that will
//  * be used as unique identifier for the variable.
//  */
// export interface Variable<T extends Constant = Constant>
//   extends TryFrom<{ Self: T; Input: Constant }> {
//   type: RowType
//   [VARIABLE_ID]?: VariableID
// }

/**
 * Variable is placeholder for a value that will be matched against by the
 * query engine.
 */
export interface Variable<T extends Constant = Constant> {
  ['?']: {
    type?: Type<T>
    id: VariableID
  }
}

export type VariableID = number

/**
 * Term is either a constant or a {@link Variable}. Terms are used to describe
 * predicates of the query.
 */
export type Term<T extends Constant = Constant> = T | Variable<T>

/**
 * Describes association between `entity`, `attribute`, `value` of the
 * {@link Fact}. Each component of the {@link _Relation} is a {@link Term}
 * that is either a constant or a {@link Variable}.
 *
 * Query engine during execution will attempt to match {@link _Relation} against
 * all facts in the database and unify {@link Variable}s across them to identify
 * all possible solutions.
 */
export type Pattern = readonly [
  entity: Term<Entity>,
  attribute: Term<Attribute>,
  value: Term<Constant>,
]

export type Is = readonly [binding: Term<Constant>, value: Term<Constant>]

export type Clause = Variant<{
  // and clause
  And: Clause[]
  // or clause
  Or: Clause[]
  // negation
  Not: Clause
  // pattern match a fact
  Case: Pattern

  // match aggregated bindings
  Form: MatchForm
  // rule application
  Rule: MatchRule
  // assign bindings
  Is: Is

  Match: Formula
}>

export type Terms = Record<string, Term> | [Term, ...Term[]] | Term

export type Numeric = Int32 | Int64 | Float32

// export type Perform<T extends any> = readonly [
//   operator: T['Operator'],
//   input: T['Input'],
//   output: T['Output'],
// ]

/**
 * Describes operand of the operator.
 */
export type Operand =
  | Constant
  | Record<string, Constant>
  | [Constant, ...Constant[]]

type EphemeralEntity =
  | Term<Entity>
  | Record<string, Term>
  | [Term<Entity>, ...Term<Entity>[]]

export type InferOperand<T extends Operand, K = T> = K extends Constant
  ? Term<T & Constant>
  : K extends Array<infer U extends Constant>
    ? Term<U>[]
    : {
        [Key in keyof K]: T[Key & keyof T] & K[Key] extends infer U extends
          Constant
          ? Term<U>
          : never
      }

export interface Operator<
  Input extends Operand,
  Relation extends string,
  Output extends Operand,
> {
  relation: Relation
  (input: Input): Iterable<Output>
}

export type Relation<
  Input extends Operand,
  Operator,
  Output extends Operand,
> = readonly [
  input: InferOperand<Input>,
  operator: Operator,
  output?: InferOperand<Output>,
]

export type TypeName =
  | 'null'
  | 'boolean'
  | 'string'
  | 'bigint'
  | 'int64'
  | 'int32'
  | 'float32'
  | 'bytes'
  | 'reference'

export type Tuple<T> = [T, ...T[]]

export type InferYield<T> = T extends Iterable<infer U> ? U : never

export type InferFormula<
  Operator extends string,
  Formula extends (input: In) => Iterable<Out>,
  In extends Operand = Parameters<Formula>[0],
  Out extends Operand = InferYield<ReturnType<Formula>>,
> = readonly [
  input: InferOperand<In>,
  operator: Operator,
  output?: InferOperand<Out>,
]

import * as DataOperators from './formula/data.js'
import * as TextOperators from './formula/text.js'
import * as UTF8Operators from './formula/utf8.js'
import * as MathOperators from './formula/math.js'

export type Formula =
  | InferFormula<'==', typeof DataOperators.is>
  | InferFormula<'data/type', typeof DataOperators.type>
  | InferFormula<'data/refer', typeof DataOperators.refer>
  | InferFormula<'text/like', typeof TextOperators.like>
  | InferFormula<'text/length', typeof TextOperators.length>
  | InferFormula<'text/words', typeof TextOperators.words>
  | InferFormula<'text/lines', typeof TextOperators.lines>
  | InferFormula<'text/case/upper', typeof TextOperators.toUpperCase>
  | InferFormula<'text/case/lower', typeof TextOperators.toUpperCase>
  | InferFormula<'text/trim', typeof TextOperators.trim>
  | InferFormula<'text/trim/start', typeof TextOperators.trimStart>
  | InferFormula<'text/trim/end', typeof TextOperators.trimEnd>
  | InferFormula<'utf8/to/text', typeof UTF8Operators.fromUTF8>
  | InferFormula<'text/to/utf8', typeof UTF8Operators.toUTF8>
  | InferFormula<'text/includes', typeof TextOperators.includes>
  | InferFormula<'text/slice', typeof TextOperators.slice>
  | InferFormula<'text/concat', typeof TextOperators.concat>
  | InferFormula<'+', typeof MathOperators.sum>
  | InferFormula<'-', typeof MathOperators.subtract>
  | InferFormula<'*', typeof MathOperators.multiply>
  | InferFormula<'/', typeof MathOperators.divide>
  | InferFormula<'%', typeof MathOperators.modulo>
  | InferFormula<'**', typeof MathOperators.power>
  | InferFormula<'math/absolute', typeof MathOperators.absolute>

export type InferTerms<T extends Terms> = T extends Term<infer U>
  ? U
  : { [Key in keyof T]: T[Key] extends Term<infer U> ? U : never }

export type Frame = Record<PropertyKey, Term>

export type Entity = Link
export type Attribute = string | Float32 | Int32 | Int64 | Bytes

/**
 * An atomic fact in the database, associating an `entity` , `attribute` ,
 * `value`.
 *
 * - `entity` - The first component is `entity` that specifies who or what the fact is about.
 * - `attribute` - Something that can be said about an `entity` . An attribute has a name,
 *    e.g. "firstName" and a value type, e.g. string, and a cardinality.
 * - `value` - Something that does not change e.g. 42, "John", true. Fact relates
 *    an `entity` to a particular `value` through an `attribute`.ich
 */
export type Fact = readonly [
  entity: Entity,
  attribute: Attribute,
  value: Constant,
]

/**
 * An atomic {@link Fact} with a `cause` field providing a causal relationship
 * that acts like timestamp.
 */
export type Datum = readonly [
  entity: Entity,
  attribute: Attribute,
  value: Constant,
  cause: Entity,
]

/**
 * Set of {@link Fact}s associating several attributes with the same new entity.
 * Each key represents an `attribute` and corresponding value represents it's
 * `value`.
 *
 * If value is an array of {@link Constant}s then entity is associated each
 * value with a same attribute.
 *
 * If value is an `Instantiation` then entity is associated with a new entity
 * that is described by that `Instantiation`.
 *
 * If value is an array of `Instantiation`s then entity is associated with a
 * each `Instantiation` in the array with an attribute corresponding to the
 * key.
 */
export interface Instantiation {
  [Key: string]: Constant | Constant[] | Instantiation | Instantiation[]
}

export interface FactsSelector {
  entity?: Entity
  attribute?: Attribute
  value?: Constant
}

export type Instruction = Variant<{
  Assert: Fact
  Retract: Fact
  Import: Instantiation
}>

export interface Transaction extends Iterable<Instruction> {}

export interface Transactor<Ok extends {} = {}> {
  transact(transaction: Transaction): Task<Ok, Error>
}

export interface Querier {
  scan(selector?: FactsSelector): Task<Datum[], Error>
}

export type Rule<Match extends Selector = Selector> = {
  select: Match
  where: Clause
}

export interface MatchRule<Match extends Selector = Selector> {
  input: Selector
  rule?: Rule<Match>
}

export interface Variables extends Record<PropertyKey, Variable> {}
export interface Bindings extends Record<PropertyKey, Constant> {}

/**
 * Selection describes set of (named) variables that query engine will attempt
 * to find values for that satisfy the query.
 */
// export interface Selector
//   extends Record<PropertyKey, Term | Term[] | Selector | Selector[]> {}
export type Selector = AggregateSelector | NamedSelector

/**
 * Where clause describes the conditions that must be satisfied for the query
 * to return a result.
 */
export type Where = Iterable<Clause>

/**
 * Query that can be evaluated against the database.
 */
export type Query<Select extends Selector = Selector> = {
  select: Select
  where: Where
}

export type AggregateSelector = [Selector | Term]

export interface NamedSelector extends Record<PropertyKey, Selector | Term> {}

export interface Variables extends Record<PropertyKey, Term> {}

export type Selection = Selector | Variable<Link<Bindings>>

export interface Not {
  not: Selector
  match?: void
  rule?: void
}

export type Combinator = Variant<{}>

export type Confirmation = Variant<{
  ok: Unit
  error: Error
}>

export interface MatchForm<Variables extends Selector = Selector> {
  selector: Variables

  confirm(selector: Selector, bindings: Bindings): Confirmation
}

/**
 * Aggregate is a stateful operation that can be used to compute results of the
 * query.
 */
export interface Aggregate<
  Type extends {
    Self: {} | null
    In: unknown
    Out: unknown
  } = {
    Self: {} | null
    In: unknown
    Out: unknown
  },
> {
  init(): Type['Self']
  /**
   * Takes the aggregator state and new input value and computes new state.
   */
  step(state: Type['Self'], input: Type['In']): Result<Type['Self'], Error>
  /**
   * Takes aggregator state and computes final result.
   */
  end(state: Type['Self']): Result<Type['Out'], Error>
}

export type InferBindings<Selection extends Selector> = {
  [Key in keyof Selection]: Selection[Key] extends Term<infer T>
    ? T
    : Selection[Key] extends Term<infer T>[]
      ? T[]
      : Selection[Key] extends Selector[]
        ? InferBindings<Selection[Key][0]>[]
        : Selection[Key] extends Selector
          ? InferBindings<Selection[Key]>
          : never
}

export type InferTerm<T extends Term> = T extends Term<infer U> ? U : never

export interface Analysis {
  dependencies: Set<VariableID>
  binds: Set<VariableID>
  cost: number
}

export interface Unplannable extends Error {
  error: this
}

export interface EvaluationPlan {
  error?: undefined

  cost: number
  evaluate(context: EvaluationContext): Task<Bindings[], EvaluationError>

  toJSON(): {}
}

export type Plan = Unplannable | EvaluationPlan

export interface EvaluationContext {
  selection: Bindings[]

  source: Querier
}

export interface EvaluationError extends Error {}

export interface Scope extends Record<PropertyKey, Variable<any>> {
  new (): Scope
  (): Scope
}
