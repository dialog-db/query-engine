import {
  Querier,
  InferOperand,
  Scalar,
  Operand,
  InferYield,
  Variable,
  Conclusion,
  Attribute,
  Entity as Subject,
  RuleBindings,
  VariableID,
  of,
  Variable as Var,
} from './link.js'
import * as DataOperators from './formula/data.js'
import * as TextOperators from './formula/text.js'
import * as UTF8Operators from './formula/utf8.js'
import * as MathOperators from './formula/math.js'

export type Term<T extends Scalar = Scalar> = T | Var<T>

export * from './api.js'

export const refer = of
// export type Select = {
//   select: { this: Term } & Record<string, Term>
//   from?: Querier
// }

// export type MatchOperator<
//   T extends (input: any) => Iterable<any> = (input: any) => Iterable<any>,
//   Formula = T extends (input: infer In) => Iterable<infer Out> ?
//     (input: In) => Iterable<Out>
//   : T,
// > = {
//   operator: {
//     formula: Formula
//     input: InferOperandCells<Parameters<Formula & T>[0]>
//     output: InferOperandCells<InferFormulaOutput<Formula>>
//   }
//   match: InferOperand<Parameters<Formula & T>[0]> &
//     Partial<InferOperand<InferFormulaOutput<Formula>>>
//   rule?: undefined
//   select?: undefined
// }

// export type InferFormulaInput<Formula> =
//   Formula extends (input: infer In) => Iterable<infer Out> ? In : never

// export type InferFormulaOutput<Formula> =
//   Formula extends (input: infer In) => Iterable<infer Out> ?
//     Out extends Constant ?
//       { this: Out }
//     : Out
//   : never

// export type CustomOperator<
//   Formula extends (input: any) => Iterable<any>,
//   In extends Operand = Parameters<Formula>[0],
//   Out extends Operand = InferYield<ReturnType<Formula>>,
// > = {
//   formula: Formula
//   input: InferOperandCells<In>
//   output: InferOperandCells<Out>
// }

// export type InferOperandCells<T> =
//   T extends Constant ? Variable<T>
//   : { [Key in keyof T]: Variable<T[Key] & Constant> }

// export type DeriveSystemOperator<
//   Operator extends string,
//   Formula extends (input: In) => Iterable<Out>,
//   In extends Operand = Parameters<Formula>[0],
//   Out extends Operand = InferYield<ReturnType<Formula>>,
// > = {
//   match: InferOperand<In> & Partial<InferOperand<Out>>
//   operator: Operator
//   Operator?: CustomOperator<Formula, In, Out>
//   Formula?: Formula
//   In?: In
//   Out?: Out
//   rule?: undefined
//   select?: undefined
// }

export type SystemOperator = {
  [Operator in keyof SystemOperators]: MatchOperator<
    SystemOperators[Operator],
    Operator
  >
}[keyof SystemOperators]

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

// type InferSystemOperator<Name extends keyof SystemOperators> = CustomOperator<
//   SystemOperators[Name]
// >

// export type WhenOperator = Select | MatchRule | MatchOperator | SystemOperator

// export type RuleWhen =
//   | [WhenOperator, ...WhenOperator[]]
//   | Record<string, [WhenOperator, ...WhenOperator[]]>

// declare function when<Source extends RuleWhen>(source: Source): void
// export { when }

// export type MatchRule<Match extends Conclusion = Conclusion> = {
//   match: RuleBindings<Match>
//   rule: Deduction<Match> | Induction<Match>
// }

// export interface Deduction<Match extends Conclusion = Conclusion> {
//   match: Match
//   when?: RuleWhen

//   repeat?: undefined
//   while?: undefined
// }

// export type Induction<
//   Match extends Conclusion = Conclusion,
//   Repeat extends Match = Match,
// > = {
//   match: Match
//   when: [WhenOperator, ...WhenOperator[]]
//   repeat: Match
//   while: RuleWhen
// }

// export function formula<T extends (input: any) => Iterable<any>>(
//   source: MatchOperator<T>
// ): void {}

declare function fact<The extends string>({
  the,
  of,
  is,
}: {
  the: The
  of?: any
  is?: any
}): {
  match(terms: { of: Term<Subject>; is: Term }): Conjunct
  (terms: { of: Term<Subject>; is: Term }): Conjunct
}

type Assertor<In, Out> = {
  assert(input: In): Out
}

declare function rule<In, W extends When, Out>(
  match: Assertor<In, Out>,
  when: W
  //   source: {
  //   match: Match
  //   when: W
  // }
): {
  //   (terms: RuleBindings<Match>): {
  //     input: InferRuleInputs<When>
  //     when: When extends [infer T] ? T : { debug: 'not tuple' }
  //     op: When extends [infer Op extends SystemOperator] ?
  //       SystemOperators[Op['operator'] & keyof SystemOperators]
  //     : never
  //   }
  //   cells: {
  //     [Key in keyof Match]: {
  //       name: Key
  //       variable: Match[Key]
  //       read: InferRead<When, Match[Key]>
  //     }
  //   }
}

// type InferRead<When, Var> =
//   When extends [infer T, ...infer U] ?
//     InferConjunctRead<T, Var> extends {} ?
//       InferConjunctRead<T, Var>
//     : InferRead<U, Var>
//   : never

// type InferConjunctRead<Operator, Var> =
//   Operator extends SystemOperator ? InferSystemOperatorRead<Operator, Var>
//   : false

// type InferSystemOperatorRead<Operator extends SystemOperator, Var> = {
//   [K in keyof Operator['match']]: Var extends Operator['match'][K] ? K : never
// }[keyof Operator['match']]
// // InferSystemOperator<Operator['operator']>['input']

// export type InferRuleInputs<When> =
//   When extends [infer T, ...infer U] ?
//     [...InferConjunctInputs<T>, ...InferRuleInputs<U>]
//   : []

// export type InferConjunctInputs<Operator> =
//   Operator extends WhenOperator ? InferOperatorInput<Operator> : []

// export type InferOperatorInput<Operator extends WhenOperator> =
//   Operator extends Select ? []
//   : Operator extends MatchRule ? []
//   : Operator extends MatchOperator<infer T> ? []
//   : Operator extends SystemOperator ? InferSystemOperatorInput<Operator>
//   : []

// export type InferSystemOperatorInput<Operator extends SystemOperator> =
//   Parameters<
//     SystemOperators[Operator['operator'] & keyof SystemOperators] &
//       ((input: any) => any)
//   >

// export { rule }

// declare const scope: Record<string, Variable>
// type Scope<T> = {
//   [Key in keyof T]: Variable<any> & {
//     readonly id: unique symbol
//     readonly key: Key
//   }
// }
// export declare const $: Scope<typeof scope>

// Proxy

// // export declare function $<Name extends string>(
// //   name: Name
// // ): Variable & { id: Name }

type FactPattern = {
  /**
   * {@link Term} representing a relation an entity `of` has with the value
   * `is`. In RDF notation this will correspond to a predicate.
   */
  the?: Term<Attribute>

  /**
   * {@link Term} representing the entity / subject.
   */
  of?: Term<Subject>

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

interface MatchFactByAttribute extends FactPattern {
  // Selection by attribute requires an attribute to be specified.
  the: Term<Attribute>
}

interface MatchFactByEntity extends FactPattern {
  // Selection by entity requires an entity to be specified.
  of: Term<Subject>
}

interface MatchFactByValue extends FactPattern {
  // Selection by value requires a value to be specified.
  is: Term<Scalar>
}

export type MatchFact =
  | MatchFactByAttribute
  | MatchFactByEntity
  | MatchFactByValue

export type Select = {
  match: MatchFact

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

// export type MatchRule<Rule extends { match: {} }> = {
//   readonly rule: Rule
//   readonly match: {
//     [Key in keyof Rule['match']]: Rule['match'][Key]
//   }

//   formula?: undefined
//   fact?: undefined
// }

export type RulePattern = RuleObjectPattern | RuleArrayPattern | Variable

export type RuleObjectPattern = {
  [Key: string]: RulePattern
}

export type RuleArrayPattern = RulePattern[]

export type Rule<Match extends RuleObjectPattern = RuleObjectPattern> =
  | Deduction<Match>
  | Induction<Match>

export interface MatchRule<
  Pattern extends RuleObjectPattern = RuleObjectPattern,
> {
  readonly rule: Rule<Pattern>
  readonly match: InferRuleTerms<Pattern>

  formula?: undefined
  fact?: undefined
}

export type InferRuleTerms<T extends RulePattern> =
  T extends Variable<infer U> ? Term<U>
  : T extends RuleArrayPattern ? InferRuleTerms<T[number]>[]
  : T extends RuleObjectPattern ?
    {
      [K in keyof T]: InferRuleTerms<T[K]>
    }
  : never

export type InferRuleBindings<Match extends Conclusion> = {
  [Key in keyof Match]: Match[Key] extends Variable<infer T> ? Term<T> : never
}

export interface Deduction<
  Match extends RuleObjectPattern = RuleObjectPattern,
> {
  readonly match: Match
  when?: When

  repeat?: undefined
  while?: undefined
}

export type Induction<
  Match extends RuleObjectPattern = RuleObjectPattern,
  Repeat extends Match = Match,
> = {
  readonly match: Match
  when: Every
  repeat: Repeat
  while: When
}

export type Constraint = Select | MatchRule | SystemOperator

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

export interface Negation {
  not: Constraint
}

export type Conjunct = Constraint | Negation | void
export type Every = readonly [Conjunct, ...Conjunct[]]
export interface Some {
  readonly [Case: string]: Every
}

export type When = Some | Every

type Type =
  | { type: 'string'; the?: Attribute }
  | { type: 'integer'; the?: Attribute }
  | { type: 'float'; the?: Attribute }
  | { type: 'boolean'; the?: Attribute }
  | { type: 'bytes'; the?: Attribute }
  | { type: 'null'; the?: Attribute }
  | { type: 'reference' }

type Collection = Array<Schema>

type Structure = {
  [Key: string]: Type | Schema
}

type Schema = Structure | Collection | Type

declare function schema<Model extends Schema>(source: Model): SchemaDSL<Model>

export type SchemaDSL<Model extends Schema, Context extends Schema = {}> = {
  // with(statement: () => void): this {
  //   return this
  // }
  (source: InferSchemaTerms<Model>): Conjunct

  // assert(data: {
  //   [Key in keyof Model]: InferType<Model[Key]>
  // }): InferModel<Model>

  with<Extension extends Structure>(
    context: Extension
  ): SchemaDSL<Model, Extension>

  where(
    toGraph: (
      input: InferSchemaVariables<Model> & { _: Variable<any> }
    ) => RelationGraph
  ): SchemaDSL<Model, Context>

  rule(
    rule: (
      input: InferSchemaVariables<Model> & { _: Variable<any> },
      context: InferSchemaVariables<Context>
    ) => DeductiveRule<Model>
  ): SchemaDSL<Model, Context> & { match: InferRuleVariable<Model>; when: When }

  terms(): InferSchemaTerms<Model>

  // match: { [Key in keyof Model]: Var<InferSchemaType<Model[Key]>> }
  // when: When

  // // when(rule: (variables: Out) => any[] | Record<string, any[]>): this {
  // //   return this
  // // }

  // // when(...args: Every): this {
  // //   return this
  // // }

  // rule(
  //   describe: (input: InferSchemaCells<Model> & Record<string, Var>) => When
  // ): SchemaDSL<Model>

  // loop<Extension extends Record<string, Schema>>(
  //   extension: Extension
  // ): Repeat<Model, Extension>
} & InferSchemaVariables<Model>

export interface RuleDescriptor<
  Model extends Schema,
  Context extends Schema,
  W extends When,
> {
  (
    input: Model, //InferSchemaVariables<Model> // & { _: Variable<any> }
    // context: InferSchemaVariables<Context>
    context: Context
  ): DeductiveRule<Model>
}

export type InferSchemaVariables<T extends Schema> =
  T extends Collection ? InferCollectionVariables<T>
  : T extends Structure ? InferStructureVariables<T>
  : T extends Type ? InferTypeVariable<T>
  : never

export type InferSchemaTerms<T extends Schema> =
  T extends Collection ? InferCollectionTerms<T>
  : T extends Structure ? InferStructureTerms<T>
  : T extends Type ? InferTypeTerms<T>
  : never

export type InferStructureVariables<T extends Structure> = Variable<Subject> & {
  [Key in keyof T]: InferSchemaVariables<T[Key]>
} & {
  this: Variable<Subject>
}

export type InferRuleStructure<Model extends Structure> = {
  [Key in keyof Model]: InferRuleVariable<Model[Key]>
}

export type InferRuleVariable<T extends Schema> =
  T extends Collection ? InferRuleVariable<T[number]>
  : T extends Type ? Variable<InferType<T>>
  : T extends Structure ? InferRuleStructure<T>
  : never

export type InferCollectionVariables<T extends Collection> =
  T extends Array<infer U extends Schema> ?
    U extends Type ?
      InferTypeVariable<U>
    : Variable<Subject> & InferSchemaVariables<U>
  : never

export type InferTypeVariable<T extends Type> = Variable<InferType<T>>

export type InferTypeTerms<T extends Type> = Term<InferType<T>>
export type InferStructureTerms<T extends Structure> = {
  [Key in keyof T]: InferSchemaTerms<T[Key]>
}

export type InferCollectionTerms<T extends Collection> =
  T extends Array<infer U extends Schema> ? InferSchemaTerms<U>[] : never

export type Mutator = {}

type Loop<Model extends Schema> = {
  match: InferSchemaCells<Model>
  when: Every
  repeat: InferSchemaCells<Model>
  while: When
}

type DeductiveRule<Model extends Schema> = {
  match: InferSchemaCells<Model>
  when: When
  repeat?: undefined
  while?: undefined
}

// export type InferModel<Model extends Schema> = {
//   [Key in keyof Model]: InferType<Model[Key]>
// }

export interface Repeat<Model extends Schema, Local extends Schema> {
  while(describe: (input: InferSchemaCells<Model & Local>) => When): this
}

type InferSchemaCells<Model extends Schema> =
  Model extends Collection ? InferCollectionCells<Model>
  : Model extends Structure ? InferStructureCells<Model>
  : Model extends Type ? InferTypeCell<Model>
  : never

type InferCollectionCells<Model extends Collection> = InferSchemaCells<
  Model[number]
>
type InferStructureCells<Model extends Structure> = {
  [Key in keyof Model]: Model[Key] extends Type ? InferTypeCell<Model[Key]>
  : Term<Subject>
}

type InferTypeCell<Model extends Type> = Term<InferType<Model>>

// type InferMatchTerms<Model extends Schema> = {
//   [Key in keyof Model]: Term<InferType<Model[Key]>>
// }

// type InferAsserts<Model extends Schema> = {
//   [Key in keyof Model]: Variable<InferType<Model[Key]>>
// }

// type InferVariables<Model extends Schema> = {
//   [Key in keyof Model]: Var<InferType<Model[Key]>>
// }

export type InferType<T extends Schema> =
  T extends { type: 'string' } ? string
  : T extends { type: 'integer' } ? number
  : T extends { type: 'float' } ? number
  : T extends { type: 'boolean' } ? boolean
  : T extends { type: 'bytes' } ? Uint8Array
  : T extends { type: 'null' } ? null
  : T extends { type: 'reference' } ? Subject
  : never

export { fact, rule, schema }
export declare const $: Record<string, Var>

export declare function asString(name: Var): asserts name is Var<string>

export declare function asInteger(name: Var): asserts name is Var<number>

export declare const Integer: {
  match(variable: Var): asserts variable is Var<number>
  (variable: Var): Var<number>
}
export declare const Entity: {
  match(variable: Var): asserts variable is Var<Subject>
  (variable: Var): Var<Subject>
}

export declare const Text: {
  match(variable: Var): asserts variable is Var<string>
  (variable: Var): Var<string>
}

type RelateSubject = { this: Var<Subject> }
type RelatePredicates = { [Key: string]: Var | Relate }

type Relate = RelateSubject & RelatePredicates
type RelationGraph = Relate

export declare function where(relation: RelationGraph): {}

export type GraphQuery = ObjectQuery

export type ObjectQuery = SubjectQuery & PredicateQuery

export type Path = `.${string}`
export type SubjectQuery = { this: Path }
export type PredicateQuery = {
  [Key: `${string}/${string}`]: Path | ObjectQuery
}

export declare function query(source: GraphQuery): InferQuery<GraphQuery>

export type InferQuery<T extends GraphQuery> = { this: { '/': Uint8Array } } & {
  [Key in keyof Omit<T, 'this'> as ToField<T[Key]>]: T[Key]
}

export type ToField<T> =
  T extends ObjectQuery ? '{}'
  : T extends `.${infer U}` ? U
  : T extends string ? T
  : never

export declare function text(): Variable<string> & { type: 'string' }
export declare function integer(): Variable<number> & { type: 'integer' }

export declare function boolean(): Variable<boolean> & { type: 'boolean' }

export declare function entity(): Variable<Subject> & { type: 'reference' }
