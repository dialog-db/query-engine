import { ByteView } from 'multiformats'
import { Task, Invocation } from './task.js'

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
  [Case in keyof T]: Exclude<keyof T, Case> extends never ? T
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
 *
 * Note we denote lexical order between types via `order` field. This is used
 * when comparing data across types.
 */
export type Type<T extends Constant = Constant> = Phantom<T> &
  Variant<{
    Null: { order: 0 }
    Boolean: { order: 1 }
    Int32: { order: 2 }
    Int64: { order: 3 }
    Float32: { order: 4 }
    String: { order: 5 }
    Bytes: { order: 6 }
    Link: { order: 9 }
  }>

// /**
//  * Variable is placeholder for a value that will be ed against by the
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

  // rule application
  Rule: RuleApplication
  // assign bindings
  Is: Is

  Match: Formula
}>

export type InferCase<
  Methods extends Record<string, (input: any, context: any) => any> = {},
> = {
  [Case in keyof Methods]: {
    Case: Case
    Input: Parameters<Methods[Case]>[0]
    Context: Parameters<Methods[Case]>[1]
    Output: ReturnType<Methods[Case]>
  }
}

export type DispatchCase<
  Methods extends Record<string, (input: {}, context: {}) => {}> = {},
> = {
  <Case extends keyof Methods>(
    input: InferCase<Methods>[Case]['Input'],
    context: InferCase<Methods>[Case]['Context']
  ): InferCase<Methods>[Case]['Output']
}
export type Dispatch<
  Methods extends Record<string, (input: any, context: any) => any> = {},
> = DispatchCase<Methods> & {
  with<Extension extends Record<string, (input: any, context: any) => any>>(
    extension: Extension
  ): Dispatch<Methods & Extension>
}

export type Terms = Record<string, Term> | [Term, ...Term[]] | Term

/**
 * Row is a named set of values which by default are {@link Term}s. It is meant
 * to represent a non-nested tuple with named members as opposed to indexed
 * members.
 */
export interface Row<T = Term> {
  [Key: string]: T
}

export type Numeric = Int32 | Int64 | Float32

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

export type InferOperand<T, K = T> = K extends Constant ? Term<T & Constant>
: K extends Array<infer U extends Constant> ? Term<U>[]
: {
    [Key in keyof K]: T[Key & keyof T] & K[Key] extends (
      infer U extends Constant
    ) ?
      Term<U>
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
  | InferFormula<'>', typeof DataOperators.greater>
  | InferFormula<'>=', typeof DataOperators.greaterOrEqual>
  | InferFormula<'<', typeof DataOperators.less>
  | InferFormula<'<=', typeof DataOperators.lessOrEqual>
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
  | InferFormula<'+', typeof MathOperators.addition>
  | InferFormula<'-', typeof MathOperators.subtraction>
  | InferFormula<'*', typeof MathOperators.multiplication>
  | InferFormula<'/', typeof MathOperators.division>
  | InferFormula<'%', typeof MathOperators.modulo>
  | InferFormula<'**', typeof MathOperators.power>
  | InferFormula<'math/absolute', typeof MathOperators.absolute>

export type InferTerms<T extends Terms> =
  T extends Term<infer U> ? U
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

export type Conclusion = Row<Variable> & {
  this?: Variable
}

export type Rule<Match extends Conclusion = Conclusion> =
  | Deduction<Match>
  | Induction<Match>

export interface Deduction<Match extends Conclusion = Conclusion> {
  readonly match: Match
  when?: When

  repeat?: undefined
  while?: undefined
}

export type Induction<
  Match extends Conclusion = Conclusion,
  Repeat extends Match = Match,
> = {
  readonly match: Match
  readonly when: Every
  readonly repeat: Repeat
  readonly while: When
}

// export type When =
//   // Has or semantics
//   | Disjuncts
//   // Has and semantics
//   | Conjuncts

// export type Constraint = Variant<{
//   Select: Pattern
//   Where: RuleApplication
//   Match: Formula
// }>

// export type Operation = Variant<{
//   Select: Pattern
//   Where: RuleApplication
//   Match: Formula
//   Not: Constraint
// }>

export type Constraint = MatchFact | MatchRule | SystemOperator

export interface Negation {
  not: Constraint
}

export type Conjunct = Constraint | Negation

export type Every = readonly [Conjunct, ...Conjunct[]]
export interface Some {
  readonly [Case: string]: Every
}

export type When = Some | Every

export interface MatchRule<Match extends Conclusion = Conclusion> {
  readonly rule: Rule<Match>
  readonly match: RuleBindings<Match>

  formula?: undefined
  fact?: undefined

  not?: undefined
}

export type MatchFact = {
  match: Select

  /**
   * The `fact` field is reserved for the future use where it could be used to
   * specify data source or
   */
  fact?: {}

  /**
   * The `rule` field can not be defined in order to be distinguishable
   * from the {@link RuleApplication} type.
   */
  rule?: undefined

  /**
   * The `not` field can not be defined in order to be distinguishable
   * from the {@link Negation} type.
   */
  not?: undefined

  operator?: undefined
}

export type Select = SelectByAttribute | SelectByEntity | SelectByValue

type SelectFact = {
  /**
   * {@link Term} representing a relation an entity `of` has with the value
   * `is`. In RDF notation this will correspond to a predicate.
   */
  the?: Term<Attribute>

  /**
   * {@link Term} representing the entity / subject.
   */
  of?: Term<Entity>

  /**
   * {@link Term} representing the value of the attribute on the entity (denoted
   * by `of`). In RDF notation this will correspond to an object.
   */
  is?: Term<Constant>

  /**
   * The `this` field is reserved for the future use where it could be used to
   * bind the merkle reference for this fact.
   */
  this?: never
}

interface SelectByAttribute extends SelectFact {
  // Selection by attribute requires an attribute to be specified.
  the: Term<Attribute>
}

interface SelectByEntity extends SelectFact {
  // Selection by entity requires an entity to be specified.
  of: Term<Entity>
}

interface SelectByValue extends SelectFact {
  // Selection by value requires a value to be specified.
  is: Term<Constant>
}

export interface FactSelection {
  select: Pattern
  rule?: undefined
}

export interface FormulaApplication {
  compute: string
  from: Pattern
}

export type InferFormulaApplication<
  Operator extends string,
  Formula extends (input: In) => Iterable<Out>,
  In extends Operand = Parameters<Formula>[0],
  Out extends Operand = InferYield<ReturnType<Formula>>,
> = {
  compute: Operator
  from: InferOperand<In>
  to?: InferOperand<Out>
}

// export interface InductiveRule<
//   Match extends Conclusion = Conclusion,
//   Repeat extends Match = Match,
// > {
//   match: Match
//   when: Conjuncts
//   repeat: Repeat
//   while: When
// }

export type SystemOperator = {
  [Operator in keyof SystemOperators]: MatchOperator<
    SystemOperators[Operator],
    Operator
  >
}[keyof SystemOperators]

export type MatchOperator<Formula = unknown, Identifier = Formula> = {
  readonly match: InferFormulaMatch<Formula>
  readonly operator: Identifier

  formula?: Formula

  rule?: undefined
  not?: undefined
  fact?: undefined
}

export type InferFormulaMatch<F> =
  F extends (input: infer In) => Iterable<infer Out> ? FormulaMatch<In, Out>
  : never

export type FormulaMatch<In, Out> = InferCells<In, 'of'> &
  Partial<InferCells<Out, 'is'>>

export type InferCells<In, DefaultName extends string> = In extends Constant ?
  { [key in DefaultName]: Term<In> }
: In extends any[] ?
  {
    [key in DefaultName]: {
      [Key in keyof In]: In[Key] extends Constant ? Term<In[Key]> : never
    }
  }
: {
    [Key in keyof In]: In[Key] extends Constant ? Term<In[Key]> : never
  }

type SystemOperators = {
  '==': typeof DataOperators.is
  '>=': typeof DataOperators.greaterOrEqual
  '>': typeof DataOperators.greater
  '<': typeof DataOperators.less
  '<=': typeof DataOperators.lessOrEqual
  'data/type': typeof DataOperators.type
  'data/refer': typeof DataOperators.refer
  'text/like': typeof TextOperators.like
  'text/length': typeof TextOperators.length
  'text/words': typeof TextOperators.words
  'text/lines': typeof TextOperators.lines
  'text/case/upper': typeof TextOperators.toUpperCase
  'text/case/lower': typeof TextOperators.toUpperCase
  'text/trim': typeof TextOperators.trim
  'text/trim/start': typeof TextOperators.trimStart
  'text/trim/end': typeof TextOperators.trimEnd
  'utf8/to/text': typeof UTF8Operators.fromUTF8
  'text/to/utf8': typeof UTF8Operators.toUTF8
  'text/includes': typeof TextOperators.includes
  'text/slice': typeof TextOperators.slice
  'text/concat': typeof TextOperators.concat
  '+': typeof MathOperators.addition
  '-': typeof MathOperators.subtraction
  '*': typeof MathOperators.multiplication
  '/': typeof MathOperators.division
  '%': typeof MathOperators.modulo
  '**': typeof MathOperators.power
  'math/absolute': typeof MathOperators.absolute
}
// /**
//  * Conjuncts are a set of {@link Operation}s that must be evaluated sequentially
//  * in an optimal order determined by interdependence of the operations.
//  */
// export type Conjuncts = readonly [Operation, ...Operation[]]

// /**
//  * Disjuncts are a named set of {@link Conclusions}s that can be
//  * evaluated in parallel.
//  */
// export interface Disjuncts extends Record<string, Conjuncts> {}

// Premise is an extension of the {@link Clause} with additional variant for
// the recursive rule application.
// export type Premise = Variant<{
//   // and clause
//   And: Clause[]
//   // or clause
//   Or: Clause[]
//   // negation
//   Not: Clause
//   // pattern match a fact
//   Case: Pattern

//   // rule application
//   Rule: RuleApplication
//   // recursive application of the rule
//   Recur: RuleRecursion
//   // assign bindings
//   Is: Is

//   Match: Formula
// }>

// export interface RuleRecursion<Case extends Conclusion = Conclusion> {
//   match: RuleBindings<Case>
//   when: Conjuncts
// }

type T = MatchOperator<SystemOperators['data/type'], 'data/type'>['match']['is']
export type RuleBindings<Case extends Conclusion = Conclusion> = {
  [Key in keyof Case]: Term<Constant>
}

export interface RuleApplication<Match extends Conclusion = Conclusion> {
  match: RuleBindings<Match>
  rule: Rule<Match>
}

export type InferRuleMatch<Case extends Conclusion> = {
  [Key in keyof Case]: Case[Key] extends Variable<infer U> ?
    U extends any ?
      Term<Constant>
    : Term<U>
  : never
}

export interface Variables extends Record<PropertyKey, Variable> {}
export interface Bindings extends Record<PropertyKey, Term> {}

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

export interface NamedSelector extends Record<string, Selector | Term> {}

export interface Variables extends Record<string, Term> {}

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
  [Key in keyof Selection]: Selection[Key] extends Term<infer T> ? T
  : Selection[Key] extends Term<infer T>[] ? T[]
  : Selection[Key] extends Selector[] ? InferBindings<Selection[Key][0]>[]
  : Selection[Key] extends Selector ? InferBindings<Selection[Key]>
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
  cost: number
  evaluate(context: EvaluationContext): Task<Bindings[], EvaluationError>
}

export type Plan = Unplannable | EvaluationPlan

export interface EvaluationContext {
  selection: Bindings[]

  source: Querier
}

export interface Evaluator extends EvaluationContext {
  evaluate(context: EvaluationContext): Task<Bindings[], EvaluationError>
}

export interface EvaluationError extends Error {}

export type Scope = Variable<any> &
  Record<PropertyKey, Variable<any>> & {
    new (): Scope
    (): Scope

    name: Variable<string>
    length: Variable<number>
    prototype: Variable
  }

/**
 * Describes the effects that clause performs when evaluated.
 */
export interface Effects {
  /**
   * Query an underlying data source for facts.
   */
  readonly query: readonly QueryEffect[]
  /**
   * Evaluate underlying clause in a loop potentially many times.
   */
  readonly loop: readonly LoopEffect[]
}

/**
 * Describes looping effect, meaning that that clause with this effect
 * may be evaluated multiple times. In a future we may capture more details
 * about the loop.
 */
export interface LoopEffect {}

export interface QueryEffect {
  select: Pattern
}

export type SchemaDescriptor = Variant<{
  Null: {}
  Boolean: {}
  Int32: {}
  Int64: {}
  Float32: {}
  String: { implicit?: string }
  Bytes: {}
  Reference: {}
  Object: { members: Record<string, SchemaDescriptor> }
  Array: { of: SchemaDescriptor }
}>

export type ScalarDescriptor =
  | null
  | BooleanConstructor
  | StringConstructor
  | NumberConstructor
  | BigIntConstructor
  | Uint8ArrayConstructor

export type ObjectDescriptor = {
  /**
   * Object descriptor must have a top level property that denotes the type
   * name it is kind of like tag in the tagged unions.
   */
  [Case: string]: {
    [Key: string]: TypeDescriptor
  }
}

export type ArrayDescriptor = [TypeDescriptor]

export type TypeDescriptor =
  | ScalarDescriptor
  | ModelDescriptor
  | ObjectDescriptor
  | ArrayDescriptor

export type ModelDescriptor<
  Descriptor extends ObjectDescriptor = ObjectDescriptor,
> = {
  Object: Descriptor
}

export type Model<T extends SchemaDescriptor = SchemaDescriptor> = T &
  Variable & {
    match(terms: Partial<InferSchemaTerms<SchemaDescriptor>>): Constraint
  }

export type InferObjectAssert<Model> = {
  [Key in keyof Model]: InferSchemaAssert<Model[Key]>
} & {
  this?: Entity
}

export type InferSchemaAssert<T> =
  T extends { Null: {} } ? null
  : T extends { Boolean: {} } ? boolean
  : T extends { Int32: {} } ? number
  : T extends { Int64: {} } ? bigint
  : T extends { Float32: {} } ? number
  : T extends { String: {} } ? string
  : T extends { Bytes: {} } ? Uint8Array
  : T extends { Reference: {} } ? Link
  : T extends { Object: { members: infer Members } } ?
    InferObjectAssert<Members>
  : T extends { Array: { of: infer Element } } ? InferSchemaAssert<Element>[]
  : never

export type InferObjectTerms<Model> = {
  [Key in keyof Model]: InferSchemaTerms<Model[Key]>['this']
} & {
  this?: Term<Entity>
}

export type InferSchemaTerms<T> =
  T extends { Null: {} } ? { this: Term<null> }
  : T extends { Boolean: {} } ? { this: Term<boolean> }
  : T extends { Int32: {} } ? { this: Term<number> }
  : T extends { Int64: {} } ? { this: Term<bigint> }
  : T extends { Float32: {} } ? { this: Term<number> }
  : T extends { String: {} } ? { this: Term<string> }
  : T extends { Bytes: {} } ? { this: Term<Uint8Array> }
  : T extends { Reference: {} } ? { this: Term<Link> }
  : T extends { Object: { members: infer Members } } ? InferObjectTerms<Members>
  : T extends { Array: { of: infer Element } } ?
    { this: Term<Entity>; of: InferSchemaTerms<Element> }
  : never

export type InferObjectVariables<Model> = {
  [Key in keyof Model]: InferSchemaVariables<Model[Key]>
} & Variable<Entity> & {
    _: Variable<any>
  }

export type InferSchemaVariables<T> =
  T extends { Null: {} } ? Variable<null>
  : T extends { Boolean: {} } ? Variable<boolean>
  : T extends { Int32: {} } ? Variable<number>
  : T extends { Int64: {} } ? Variable<bigint>
  : T extends { Float32: {} } ? Variable<number>
  : T extends { String: {} } ? Variable<string>
  : T extends { Bytes: {} } ? Variable<Uint8Array>
  : T extends { Reference: {} } ? Variable<Link>
  : T extends { Object: { members: infer Members } } ?
    InferObjectVariables<Members>
  : T extends { Array: { of: infer Element } } ? InferSchemaVariables<Element>
  : never

export type InferArraySchema<T> =
  T extends TypeDescriptor ? InferTypeSchema<T>[] : never

export type InferSchemaType<T extends TypeDescriptor> =
  T extends null ? null
  : T extends BooleanConstructor ? boolean
  : T extends StringConstructor ? string
  : T extends NumberConstructor ? Int32
  : T extends BigIntConstructor ? Int64
  : T extends Uint8ArrayConstructor ? Bytes
  : T extends ModelDescriptor<infer Descriptor> ? InferSchemaType<Descriptor>
  : T extends [infer Element] ? Element[]
  : T extends ObjectDescriptor ?
    {
      [Case in keyof T]: {
        [Key in keyof T[Case]]: InferSchemaType<T[Case][Key]>
      }
    }[keyof T]
  : never

export type InferTypeSchema<T extends TypeDescriptor | ScalarDescriptor> =
  T extends null ? ScalarSchema<null>
  : T extends BooleanConstructor ? ScalarSchema<boolean>
  : T extends StringConstructor ? ScalarSchema<string>
  : T extends NumberConstructor ? ScalarSchema<Int32>
  : T extends BigIntConstructor ? ScalarSchema<Int64>
  : T extends Uint8ArrayConstructor ? ScalarSchema<Bytes>
  : T extends [infer Element] ? InferArraySchema<Element>
  : T extends ObjectDescriptor ?
    ObjectSchema<string & keyof T, InferSchemaType<T>, T>
  : T extends ModelDescriptor<infer D> ? InferTypeSchema<D>
  : never

export type InferTypeTerms<T> =
  T extends Constant ? Term<T>
  : Partial<
      { this: Term<Entity> } & { [Key in keyof T]: InferTypeTerms<T[Key]> }
    >

export type InferTypeVariables<T> =
  T extends Constant ? Variable<T>
  : { this: Term<Entity> } & {
      [Key in keyof T]: InferTypeVariables<T[Key]>
    }

export type ArraySchema<Of> = {
  $: Variable<Entity>
  match(terms: {
    this?: Term<Entity>
    of: Partial<InferTypeTerms<Of>>
  }): Constraint
}

export type ObjectSchema<
  Label extends string,
  T,
  Descriptor extends ObjectDescriptor,
> = {
  $: Variable<Entity>
  label: Label
  match(terms: Partial<InferTypeTerms<T>>): Constraint
  select(
    terms: Partial<InferTypeTerms<T>> & { from: Querier }
  ): Invocation<T[], EvaluationError>

  Object: Descriptor

  when(
    derive: (variables: InferTypeVariables<T>) => Iterable<Constraint>
  ): ObjectSchema<Label, T, Descriptor>
}

export interface SchemaDSL {
  variables: Variables
}

export interface ScalarSchema<T extends Constant = Constant> {
  type: TypeName
  variables: { this: Variable<T> }
  match(terms: { this?: Term<T> }): Constraint

  Object?: undefined

  view(match: Bindings): T
}

export interface EntitySchema<
  Model = {},
  Descriptor extends ObjectDescriptor = ObjectDescriptor,
  Label extends string = string,
> {
  label: Label
  Object: Descriptor
  variables: SchemaVariables

  members: Record<string, EntityMember>
  rule: Deduction

  new (model: Model & { this: Entity }): EntityView<Model>
  new: (model: Model & { this: Entity }) => EntityView<Model>

  view(match: Bindings): EntityView<Model>

  match(terms: Partial<InferTypeTerms<Model>>): Constraint

  select(
    terms: Partial<InferTypeTerms<Model>> & { from: Querier }
  ): Invocation<EntityView<Model>[], EvaluationError>

  when(
    derive: (variables: InferTypeVariables<Model>) => Iterable<Constraint>
  ): EntitySchema<Model, Descriptor, Label>
}

export type EntityView<Model> = Model & {
  this: Entity
}

export type SchemaVariables = {
  [key: string]: Variable | SchemaVariables
} & {
  this: Variable<Constant>
}

export type TermTree = {
  [Key: string]: Term | TermTree
}

export type EntityMember = ScalarSchema | EntitySchema
