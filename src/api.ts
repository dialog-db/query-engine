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
 * Variable integer.
 */
export type Integer = New<{ Integer: number }>

export type Float = New<{ Float: number }>

/**
 * Type representing a raw bytes.
 */
export type Bytes = Uint8Array

export type Null = null

export type Reference = New<{ Reference: string }>

export type Name = New<{ Name: string }>

export type Position = New<{ Position: string }>

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
export type Scalar =
  | null
  | boolean
  | bigint
  | Integer
  | Float
  | string
  | Bytes
  | Link

/**
 * @deprecated Use `Scalar` instead.
 */
export type Constant = Scalar

/**
 * Supported primitive types. Definition utilizes `Phantom` type to describe
 * the type for compile type inference and `Variant` type to describe it for
 * the runtime inference.
 *
 * Note we denote lexical order between types via `order` field. This is used
 * when comparing data across types.
 */
export type Type<T extends Scalar = Scalar> = Phantom<T> &
  Variant<{
    Null: {}
    Boolean: {}
    Integer: {}
    Float: {}
    String: {}
    Bytes: {}
    Entity: {}
    Name: {}
    Position: {}
    Reference: {}
    Unknown: {}
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
export interface Variable<T extends Scalar = Scalar> {
  ['?']: {
    type?: Type<T>
    id: VariableID
  }

  // is(term: Term): Conjunct
  // not(term: Term): Conjunct
}

export type VariableID = number

/**
 * Term is either a constant or a {@link Variable}. Terms are used to describe
 * predicates of the query.
 */
export type Term<T extends Scalar = Scalar> = T | Variable<T>

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
  value: Term<Scalar>,
]

export type Is = readonly [binding: Term<Scalar>, value: Term<Scalar>]

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

export type Numeric = Integer | Float

/**
 * Describes operand of the operator.
 */
export type Operand = Scalar | Record<string, Scalar> | [Scalar, ...Scalar[]]

type EphemeralEntity =
  | Term<Entity>
  | Record<string, Term>
  | [Term<Entity>, ...Term<Entity>[]]

export type InferOperand<T, K = T> = K extends Scalar ? Term<T & Scalar>
: K extends Array<infer U extends Scalar> ? Term<U>[]
: {
    [Key in keyof K]: T[Key & keyof T] & K[Key] extends infer U extends Scalar ?
      Term<U>
    : never
  }

export type TypeName =
  | 'null'
  | 'boolean'
  | 'string'
  | 'bigint'
  | 'integer'
  | 'float'
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
export type Attribute = string

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
export interface Fact<
  T extends The = The,
  Of extends Entity = Entity,
  Is extends Scalar = Scalar,
> {
  the: The
  of: Of
  is: Is
}

/**
 * An atomic {@link Fact} with a `cause` field providing a causal relationship
 * that acts like timestamp.
 */
export interface Datum<
  T extends The = The,
  Of extends Entity = Entity,
  Is extends Scalar = Scalar,
> extends Fact<T, Of, Is> {
  cause: Entity
}

/**
 * Set of {@link Fact}s associating several attributes with the same new entity.
 * Each key represents an `attribute` and corresponding value represents it's
 * `value`.
 *
 * If value is an array of {@link Scalar}s then entity is associated each
 * value with a same attribute.
 *
 * If value is an `Instantiation` then entity is associated with a new entity
 * that is described by that `Instantiation`.
 *
 * If value is an array of `Instantiation`s then entity is associated with a
 * each `Instantiation` in the array with an attribute corresponding to the
 * key.
 */
export interface DataImport {
  [Key: string]: Scalar | Scalar[] | DataImport | DataImport[]
}

export interface FactsSelector {
  the?: Attribute
  of?: Entity
  is?: Scalar
}

export type Instruction = Variant<{
  assert: Fact
  retract: Fact
}>

export interface Transaction extends Iterable<Instruction> {}

export interface Transactor<Ok extends {} = {}> {
  transact(transaction: Transaction): Task<Ok, Error>
}

export interface Querier {
  select(selector?: FactsSelector): Task<Datum[], Error>
}

export type Proposition = Row<Variable> & {
  this?: Variable
}

export type Rule<Match extends Proposition = Proposition> = DeductiveRule<Match>

export interface DeductiveRule<Match extends Proposition = Proposition> {
  readonly match: Match
  readonly when?: When<Conjunct | Recur>
}

export type Constraint = SelectForm | MatchRule | SystemOperator

export interface Negation {
  not: Constraint

  operator?: undefined
  fact?: undefined
  rule?: undefined
  match?: undefined
  recur?: undefined
}

export type Conjunct = Constraint | Negation
export type Recur<Match extends Proposition = Proposition> = {
  recur: RuleBindings<Match>

  operator?: undefined
  fact?: undefined
  rule?: undefined
  match?: undefined
  not?: undefined
}

export type Every<T extends Conjunct | Recur = Conjunct> = Iterable<T>
export interface Some<T extends Conjunct | Recur = Conjunct> {
  readonly [Case: string]: Every<T>
}

export type When<T extends Conjunct | Recur = Conjunct> = Some<T>

export type WhenBuilder<T extends RuleDescriptor> =
  | SomeBuilder<T>
  | EveryBuilder<T>

export type SomeBuilder<T extends RuleDescriptor> = (
  variables: InferSchemaAttributes<T> & { _: Variable<any> }
) => SomeView
export type EveryBuilder<T extends RuleDescriptor> = (
  variables: InferSchemaAttributes<T> & { _: Variable<any> }
) => EveryView

export type ProjectionBuilder<
  T extends RuleDescriptor,
  Projection extends Selector,
> = (variables: InferSchemaAttributes<T>) => Projection

export type WhenView = EveryView | SomeView
export type EveryView = ConjunctView[]
export type ConjunctView = Conjunct | MatchView<unknown> | void

export interface SomeView {
  [Case: string]: EveryView
}

export interface MatchRule<Match extends Proposition = Proposition> {
  readonly match: Partial<RuleBindings<Match>>
  readonly rule: Rule<Match>

  operator?: undefined
  fact?: undefined

  not?: undefined

  recur?: undefined
}

export interface Syntax {
  toJSON(): object
  toDebugString(): string

  plan(scope: Scope): EvaluationPlan
}

export interface SelectSyntax extends Syntax, SelectForm {}

export interface RuleSyntax<Match extends Proposition = Proposition>
  extends Syntax,
    DeductiveRule<Match> {
  plan(scope: Scope): RulePlan
}

export interface RuleApplicationSyntax<Match extends Proposition = Proposition>
  extends Syntax,
    MatchRule<Match> {
  negate(): NegationSyntax
  plan(scope: Scope): RuleApplicationPlan<Match>
  prepare(): RuleApplicationPlan<Match>
}

export interface DeductiveRuleSyntax<Match extends Proposition = Proposition>
  extends Syntax,
    DeductiveRule<Match> {
  apply(terms?: RuleBindings<Match>): RuleApplicationSyntax<Match>
}

export interface RuleRecursionSyntax<Match extends Proposition = Proposition>
  extends Recur<Match> {}

export interface NegationSyntax extends Syntax, Negation {}

export interface SelectForm {
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

  recur?: undefined
}

export type Select = SelectByAttribute | SelectByEntity | SelectByValue

type SelectBy = {
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
  is?: Term<Scalar>

  /**
   * The `this` field is reserved for the future use where it could be used to
   * bind the merkle reference for this fact.
   */
  this?: never
}

interface SelectByAttribute extends SelectBy {
  // Selection by attribute requires an attribute to be specified.
  the: Term<Attribute>
}

interface SelectByEntity extends SelectBy {
  // Selection by entity requires an entity to be specified.
  of: Term<Entity>
}

interface SelectByValue extends SelectBy {
  // Selection by value requires a value to be specified.
  is: Term<Scalar>
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

  fact?: undefined
  rule?: undefined
  not?: undefined
  recur?: undefined
}

export type InferFormulaMatch<F> =
  F extends (input: infer In) => Iterable<infer Out> ? FormulaMatch<In, Out>
  : never

export type FormulaMatch<In, Out> = InferCells<In, 'of'> &
  Partial<InferCells<Out, 'is'>>

export type InferCells<In, DefaultName extends string> = In extends Scalar ?
  { [key in DefaultName]: Term<In> }
: In extends any[] ?
  {
    [key in DefaultName]: {
      [Key in keyof In]: In[Key] extends Scalar ? Term<In[Key]> : never
    }
  }
: {
    [Key in keyof In]: In[Key] extends Scalar ? Term<In[Key]> : never
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

export type RuleBindings<Case extends Proposition = Proposition> = {
  [Key in keyof Case]: Term<Scalar>
}

export interface RuleApplication<Match extends Proposition = Proposition> {
  // ⚠️ This is actually Partial<RuleBindings<Match>> but we still type it
  // without `Partial` because at the type level we have no good way of
  // omitting variables that could be ignored
  match: RuleBindings<Match>
  rule: Rule<Match>
}

export type InferRuleMatch<Case extends Proposition> = {
  [Key in keyof Case]: Case[Key] extends Variable<infer U> ?
    U extends any ?
      Term<Scalar>
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
  not: Constraint
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
  evaluate(context: EvaluationContext): Task<MatchFrame[], EvaluationError>
}

/**
 * Represents a local variable references to a remote variables. This is n:1
 * relation meaning multiple local variables may point to the same remote one
 * but local variable can point to at most one remote variable.
 */
export type Cursor = Map<Variable, Set<Variable>>

/**
 * Represents set of bound variables.
 */
export type QueryBindings = Map<Variable, Scalar>

export interface Scope {
  references: Cursor
  bindings: QueryBindings
}

export type Plan = Unplannable | EvaluationPlan

export interface RulePlan extends EvaluationPlan {
  cost: number
  match: Proposition
}

export interface RuleApplicationPlan<Match extends Proposition>
  extends EvaluationPlan {
  cost: number
  toJSON(): object
  query(source: { from: Querier }): Task<MatchFrame[], Error>
}

export interface EvaluationContext {
  selection: MatchFrame[]
  source: Querier
  self: RulePlan
  recur: [MatchFrame, MatchFrame][] // Array of pairs [nextBindings, originalContext] for recursive processing
}

export interface Evaluator extends EvaluationContext {
  evaluate(context: EvaluationContext): Task<Bindings[], EvaluationError>
}

export interface EvaluationError extends Error {}

export type $ = Variable<any> &
  Record<PropertyKey, Variable<any>> & {
    new (): $
    (): $

    name: Variable<string>
    length: Variable<number>
    prototype: Variable
  }

export interface MatchFrame extends Map<Variable, Scalar> {
  parent?: MatchFrame
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

export type ObjectDescriptor = {
  [Key: string]: TypeDescriptor
}

export type ArrayDescriptor = [TypeDescriptor] & {
  Object?: undefined
  Rule?: undefined
}

export type UnknownDescriptor = {
  Unknown: {}
}

export type TypeDescriptor =
  | Scalar
  | ScalarConstructor
  | Type
  | ObjectDescriptor
  | ArrayDescriptor

export type InferDescriptorType<T> =
  T extends null ? null
  : T extends { Null: {} } ? null
  : T extends BooleanConstructor ? boolean
  : T extends { Boolean: {} } ? boolean
  : T extends boolean ? T
  : T extends StringConstructor ? string
  : T extends { String: {} } ? string
  : T extends string ? T
  : T extends NumberConstructor ? Integer
  : T extends { Integer: {} } ? Integer
  : T extends { Float: {} } ? Float
  : T extends number ? T
  : T extends BigIntConstructor ? bigint
  : T extends bigint ? T
  : T extends Uint8ArrayConstructor ? Bytes
  : T extends { Bytes: {} } ? Bytes
  : T extends Uint8Array ? T
  : T extends ObjectConstructor ? Entity
  : T extends UnknownDescriptor ? Scalar
  : never

export type ScalarConstructor =
  | BooleanConstructor
  | StringConstructor
  | NumberConstructor
  | BigIntConstructor
  | Uint8ArrayConstructor
  | ObjectConstructor

export type ScalarDescriptor = Variant<{
  Null: {}
  Boolean: {}
  String: {}
  Int32: {}
  Float32: {}
  Int64: {}
  Bytes: {}
  Reference: {}
  Entity: {}
  Unknown: {}
}> & { Object?: undefined; Fact?: undefined; Scalar?: undefined }

export type ModelDescriptor<
  Descriptor extends ObjectDescriptor = ObjectDescriptor,
> = {
  Object: Descriptor
}

export type InferTypeTerms<T, U = T> = T extends Scalar ?
  Term<U extends Scalar ? U : never>
: unknown extends T ? Term
: InferEntityTerms<T>

export type TypeTest<T> = T extends Scalar ? Box<T> : never

export type Box<T> = {
  t: T
}
export type InferEntityTerms<T> = Partial<
  { this: Term<Entity> } & { [Key in keyof T]: InferTypeTerms<T[Key]> }
>

export type InferTypeVariables<T, U = T> = T extends Scalar ?
  Variable<U extends Scalar ? U : never>
: unknown extends T ? Variable<any>
: { this: Term<Entity> } & {
    [Key in keyof T]: InferTypeVariables<T[Key]>
  }

export interface RuleDescriptor {
  [key: string]: ScalarConstructor | Type | Scalar
}

export interface FactSchema extends RuleDescriptor {
  this: ObjectConstructor
}

export type InferSchemaAttributes<Schema> = {
  [Key in keyof Schema]: Variable<InferDescriptorType<Schema[Key]>>
}

export type InferSchemaTerms<T> = {
  [Key in keyof T]: Term<InferDescriptorType<T[Key]>>
}

export type InferFact<Schema extends RuleDescriptor> = {
  [Key in keyof Schema]: InferDescriptorType<Schema[Key]>
}

export type InferRuleAssert<T extends RuleDescriptor> = {
  [Key in keyof T as T[Key] extends Scalar ? never : Key]: T[Key] extends (
    Scalar
  ) ?
    undefined
  : InferDescriptorType<T[Key]>
}

export type ScalarTerms<T extends Scalar> = Term<T> | { this: Term<T> }

export interface MatchView<Model = unknown>
  extends Iterable<Recur | Conjunct> {}

export interface QueryView<Model> extends Iterable<Conjunct> {
  select(source: { from: Querier }): Invocation<Model[], Error>
}

export type EntityModel<T extends {} = {}> = {
  this: Entity
} & T

export type FactModel = {
  the?: The
  of?: EntityModel
  is?: Scalar | {}
}

export interface RuleApplicationView<View>
  extends RuleApplication,
    MatchView<View> {
  select(source: { from: Querier }): Invocation<View[], Error>
}

export type EntityView<Model> = Model & {
  this: Entity
}

export type TermTree = {
  [Key: string]: Term | TermTree
}

export type The = `${string}/${string}`

export interface FactCells {
  the: Variable<string>
  of: Variable<Entity>
  is: Variable<Scalar>
}

export type Descriptor = null | boolean

interface TextVariable extends Variable<string> {
  like(pattern: Term<string>): Constraint
  toUpperCase(is: Term<string>): Constraint
  toLowerCase(is: Term<string>): Constraint
}

export type InferFactTerms<T extends FactSchema> = {
  [Key in keyof Omit<T, 'this'>]: Term<InferDescriptorType<T[Key]>>
} & {
  this?: Term<Entity>
}

export type InferAssert<Schema extends FactSchema> = InferFact<
  Omit<Schema, 'this'>
> & { this?: Entity }

export type InferClaimTerms<Schema extends FactSchema> = InferFactTerms<Schema>

export type InferAttributes<Schema> = {
  [Key in keyof Schema]: Variable<InferDescriptorType<Schema[Key]>>
}

export interface Premise<The extends string, Schema extends FactSchema> {
  readonly the: The
  readonly attributes: InferAttributes<Schema & { this: ObjectDescriptor }>
  readonly schema: Schema
}

export interface Conclusion<
  Fact,
  The extends string,
  Schema extends FactSchema,
> {
  assert(fact: InferAssert<Schema>): Fact
}

export interface Claim<
  Fact,
  The extends string,
  Schema extends FactSchema,
  Context extends RuleDescriptor,
> extends Relation<Fact, The, Schema> {
  the: The
  attributes: InferSchemaAttributes<Schema>
  schema: Schema

  /**
   * Defines temporary variables made available in the {@link when} /
   * {@link where} builder methods so they can be used inside the rule body.
   */
  with<Extension extends Exclude<RuleDescriptor, Schema & Context>>(
    extension: Extension
  ): Claim<Fact, The, Schema, Context & Extension>

  /**
   * Defines a rule that concludes fact corresponding to this premise whenever
   * all of the predicates returne by `derive` method are true. This is a
   * shortuct for {@link when} which is convinient in cases with a single
   * branch.
   */
  where(
    derive: EveryBuilder<Schema & Context>
  ): Deduction<Fact, The, Schema, {}>

  /**
   * Defines a rule that deduces this fact whenever any of the branches are true.
   * Takes a `build` function that will be given set of variables corresponding
   * to the fact members which must return object where keys represent disjuncts
   * and values are arrays representing conjuncts for those disjuncts. In other
   * works each member of the returned object represent OR branches where each
   * branch is an AND joined predicates by passed variables.
   */
  when(derive: SomeBuilder<Schema & Context>): Deduction<Fact, The, Schema, {}>

  map<View>(mapper: (fact: Fact) => View): Claim<View, The, Schema, Context>
}

export interface NegationPredicate extends Iterable<Negation> {}

/**
 *
 */
export interface Predicate<Fact, The extends string, Schema extends FactSchema>
  extends Iterable<Recur | Conjunct> {
  query(source: { from: Querier }): Invocation<Fact[], Error>
}

export interface Assertion extends Iterable<{ assert: Fact }> {}

export type FactView<
  The extends string,
  Schema extends FactSchema,
> = InferFact<Schema> & {
  the: The
  toJSON(): InferFact<Schema> & { the: The }
  
} & Assertion & Retractable


export interface Retractable {
  retract(): Iterable<{ retract: Fact }>
}

export interface Relation<Fact, The extends string, Schema extends FactSchema> {
  /**
   * Creates a predicate that matches this premise. This is just like
   * {@link match} except it requires passing all members explicitly,
   * this allows type checker to ensure that no members are left out by
   * accident.
   */
  (terms?: InferFactTerms<Schema>): Predicate<Fact, The, Schema>

  /**
   * Creates predicate that matches this premise. It may be passed terms for
   * the subset of the fact members. Omitted members are treated as `_` meaning
   * any value would satisfy them.
   */
  match(terms?: Partial<InferFactTerms<Schema>>): Predicate<Fact, The, Schema>

  /**
   * Creates negation (anti-join) that will omit all the facts that match
   * the premise with the given terms.
   */
  not(terms: Partial<InferSchemaTerms<Schema>>): NegationPredicate

  /**
   * Creates an assertion for this the fact denoted by this premise, which can
   * be transacted in the DB.
   */
  assert(fact: InferAssert<Schema>): Fact
}

export interface Deduction<
  Fact,
  The extends string,
  Schema extends FactSchema,
  Context extends RuleDescriptor,
> extends Claim<Fact, The, Schema, Context> {
  inductive: Relation<Fact, The, Schema>
  /**
   * Creates an assertion for this the fact denoted by this premise, which can
   * be transacted in the DB.
   */
  claim(fact: InferFactTerms<Schema>): Iterable<Conjunct>

  select<Terms extends Selector>(
    derive: ProjectionBuilder<Schema & Context, Terms>
  ): Projection<Schema, Terms>

  map<View>(mapper: (fact: Fact) => View): Deduction<View, The, Schema, Context>
}

export interface Projection<Schema extends FactSchema, Terms extends Selector> {
  (terms?: InferSchemaTerms<Schema>): SelectionPredicate<Terms>
  match(terms?: Partial<InferSchemaTerms<Schema>>): SelectionPredicate<Terms>
}

export interface SelectionPredicate<Terms extends Selector>
  extends Iterable<Recur | Conjunct> {
  query(source: { from: Querier }): Invocation<InferBindings<Terms>[], Error>
}
