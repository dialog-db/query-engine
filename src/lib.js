import * as API from './api.js'
export * from './api.js'
export { API }

/**
 * @typedef {number} Integer
 * @typedef {number} Float
 * @typedef {Readonly<Uint8Array>} Bytes
 * @typedef {string} UTF8
 *
 * @typedef {string|Float|Integer} Entity
 * @typedef {Integer|Float|Bytes|UTF8} Attribute
 * @typedef {boolean|UTF8|Integer|Float|Bytes} Data
 */

/**
 * Database is represented as a collection of facts.
 * @typedef {object} Database
 * @property {number} [entityCount]
 * @property {readonly Fact[]} facts
 */

/**
 * An atomic fact in the database, associating an `entity` , `attribute` ,
 * `value`.
 *
 * - `entity` - The first component is `entity` that specifies who or what the fact is about.
 * - `attribute` - Something that can be said about an `entity` . An attribute has a name,
 *    e.g. "firstName" and a value type, e.g. string, and a cardinality.
 * - `value` - Something that does not change e.g. 42, "John", true. Fact relates
 *    an `entity` to a particular `value` through an `attribute`.ich
 *
 * @typedef {readonly [entity: Entity, attribute: Attribute, value: Data]} Fact
 */

/**
 * Creates an assertion.
 *
 * @template {Entity} E
 * @template {Attribute} A
 * @template {Data} V
 *
 * @param {E} entity
 * @param {A} attribute
 * @param {V} value
 * @returns {readonly [entity: E, attribute:A, value:V]}
 */
export const assert = (entity, attribute, value) => [entity, attribute, value]

/**
 * Variable is placeholder for a value that will be matched against by the
 * query engine. It is represented as an abstract `Reader` that will attempt
 * to read arbitrary {@type Data} and return result with either `ok` of the
 * `Type` or an `error`.
 *
 * Variables will be assigned unique `bindingKey` by a query engine that will
 * be used as unique identifier for the variable.
 *
 * @template {Data} [Type=Data]
 * @typedef {API.TryFrom<{ Self: Type, Input: Data }> & {[PROPERTY_KEY]?: PropertyKey}} Variable
 */

/**
 * Term is either a constant or a {@link Variable}. Terms are used to describe
 * predicates of the query.
 *
 * @typedef {Data|Variable} Term
 */

/**
 * Describes association between `entity`, `attribute`, `value` of the
 * {@link Fact}. Each component of the {@link Relation} is a {@link Term}
 * that is either a constant or a {@link Variable}.
 *
 * Query engine during execution will attempt to match {@link Relation} against
 * all facts in the database and unify {@link Variable}s across them to identify
 * all possible solutions.
 *
 * @typedef {[entity: Term, attribute: Term, value: Term]} Relation
 */

/**
 * @typedef {{where: Relation[]}} Predicate
 */

/**
 * Selection describes set of (named) variables that query engine will attempt
 * to find values for that satisfy the query.
 *
 * @typedef {Record<PropertyKey, Variable>} Selector
 */

/**
 * @template {Selector} Selection
 * @typedef {{[Key in keyof Selection]: Selection[Key] extends Variable<infer T> ? T : never}} InferMatch
 */

/**
 * @template {Selector} Selection
 * @typedef {{[Key in keyof Selection]: Selection[Key] extends Variable<infer T> ? (Variable<T> | T) : never}} InferState
 */

const ENTITY = 0
const ATTRIBUTE = 1
const VALUE = 2

/**
 * @template {Selector} Selection

 * @param {Relation} relation
 * @param {Fact} fact
 * @param {InferState<Selection>} context
 * @returns {InferState<Selection>|null}
 */
export const matchRelation = (relation, fact, context) => {
  let state = context
  for (const id of [ENTITY, ATTRIBUTE, VALUE]) {
    const match = matchTerm(relation[id], fact[id], state)
    if (match) {
      state = match
    } else {
      return null
    }
  }

  return state
}

/**
 * @template {Selector} Selection
 *
 * @param {Term} term
 * @param {Data} data
 * @param {InferState<Selection>} context
 */
export const matchTerm = (term, data, context) =>
  // If we match against `_` we succeed and do not capture any bindings as we
  // do not want to unify against all other uses of `_`.
  isBlank(term)
    ? context
    : // If term is a variable then we attempt to match a data against it and
      // unify with previously matched binding.

      isVariable(term)
      ? matchVariable(term, data, context)
      : // Otherwise we match the constant
        matchConstant(term, data, context)

/**
 * @template Context
 *
 * @param {Data} constant
 * @param {Data} data
 * @param {Context} context
 * @returns {Context|null}
 */
export const matchConstant = (constant, data, context) =>
  constant === data ? context : null

/**
 * @typedef {Record<string|symbol, Data>} Context
 */

/**
 * @template {Selector} Selection
 *
 * @param {Variable} variable
 * @param {Data} data
 * @param {InferState<Selection>} context
 * @returns {InferState<Selection>|null}
 */
export const matchVariable = (variable, data, context) => {
  // Get key this variable is bound to in the context
  const key = SelectedVariable.getPropertyKey(variable)
  // If context already contains binding for we attempt to unify it with the
  // new data otherwise we bind the data to the variable.
  if (key in context) {
    return matchTerm(context[key], data, context)
  } else {
    const result = variable.tryFrom(data)
    return result.error ? null : { ...context, [key]: result.ok }
  }
}

/**
 * @template {Data} T
 * @param {unknown|Variable<T>} x
 * @returns {x is Variable<T>}
 */
const isVariable = (x) => {
  return (
    typeof x === 'object' &&
    x !== null &&
    'tryFrom' in x &&
    typeof x.tryFrom === 'function'
  )
}

/**
 *
 * @param {unknown} x
 * @returns {x is Schema._}
 */
const isBlank = (x) => x === Schema._

/**
 * @template {Selector} Selection
 * @param {Relation} relation
 * @param {Database} db
 * @param {InferState<Selection>} context
 * @returns {InferState<Selection>[]}
 */
const queryRelation = (relation, { facts }, context) => {
  const matches = []
  for (const fact of facts) {
    const match = matchRelation(relation, fact, context)
    if (match) {
      matches.push(match)
    }
  }

  return matches
}

/**
 * @template {Selector} Selection
 * @param {Database} db
 * @param {Relation[]} relations
 * @param {InferState<Selection>} context
 * @returns {InferState<Selection>[]}
 */
export const queryRelations = (db, relations, context) =>
  relations.reduce(
    /**
     * @param {InferState<Selection>[]} contexts
     * @param {Relation} relation
     * @returns
     */
    (contexts, relation) =>
      contexts.flatMap((context) => queryRelation(relation, db, context)),
    [context]
  )

/**
 * Takes a selector which is set of variables that will be used in the query
 * conditions. Returns a query builder that has `.where` method for specifying
 * the query conditions.
 *
 * @example
 * ```ts
 * const moviesAndTheirDirectorsThatShotArnold = select({
 *    directorName: Schema.string(),
 *    movieTitle: Schema.string(),
 * }).where(({ directorName, movieTitle }) => {
 *    const arnoldId = Schema.number()
 *    const movie = Schema.number()
 *    const director = Schema.number()
 *
 *    return [
 *      [arnold, "person/name", "Arnold Schwarzenegger"],
 *      [movie, "movie/cast", arnoldId],
 *      [movie, "movie/title", movieTitle],
 *      [movie, "movie/director", director],
 *      [director, "person/name", directorName]
 *   ]
 * })
 * ```
 *
 * @template {Selector} Selection
 * @param {Selection} selector
 * @returns {QueryBuilder<Selection>}
 */
export const select = (selector) => new QueryBuilder({ select: selector })

/**
 * @template {Selector} Selection
 * @param {Database} db
 * @param {object} source
 * @param {Selection} source.select
 * @param {Iterable<Relation|Predicate>} source.where
 * @returns {InferMatch<Selection>[]}
 */
export const query = (db, { select, where }) => {
  /** @type {Relation[]} */
  const relations = []

  for (const relation of where) {
    if (Array.isArray(relation)) {
      relations.push(relation)
    } else {
      relations.push(...relation.where)
    }
  }

  for (const attribute of Object.values(select)) {
    if (attribute instanceof DataAttribute) {
      relations.push(attribute._)
    }
  }

  const contexts = queryRelations(
    db,
    relations,
    /** @type {InferState<Selection>} */ ({})
  )
  return contexts.map((context) => materialize(select, context))
}
/**
 * A query builder API which is designed to enable type inference of the query
 * and the results it will produce.
 *
 * @template {Selector} Select
 */
class QueryBuilder {
  /**
   * @param {object} source
   * @param {Select} source.select
   */
  constructor({ select }) {
    this.select = select
  }
  /**
   * @param {(variables: Select) => Iterable<Relation|Predicate>} conditions
   * @returns {Query<Select>}
   */
  where(conditions) {
    return new Query({
      select: this.select,
      where: [...conditions(this.select)],
    })
  }
}

/**
 * @template {Record<string, unknown>} Object
 * @param {Object} object
 * @returns {{[Key in keyof Object]: [Key, Object[Key]]}[keyof Object][]}
 */
const entries = (object) => /** @type {any} */ (Object.entries(object))

/**
 * @template {Selector} Selection
 */
class Query {
  /**
   * @param {object} model
   * @param {Selection} model.select
   * @param {(Relation|Predicate)[]} model.where
   */
  constructor(model) {
    this.model = model
  }

  /**
   *
   * @param {Database} db
   * @returns {InferMatch<Selection>[]}
   */
  execute(db) {
    return query(db, this.model)
  }
}

/**
 * @template {Selector} Selection
 * @param {Selection} select
 * @param {InferState<Selection>} context
 * @returns {InferMatch<Selection>}
 */
const materialize = (select, context) =>
  /** @type {InferMatch<Selection>} */
  (
    Object.fromEntries(
      entries(select).map(([name, variable]) => [
        name,
        isVariable(variable)
          ? context[SelectedVariable.getPropertyKey(variable)]
          : variable,
      ])
    )
  )

const IS = Symbol.for('is')
const PROPERTY_KEY = Symbol.for('propertyKey')

/**
 * @template {Data} T
 * @implements {API.TryFrom<{ Self: T, Input: Data }>}
 */
export class Schema {
  /**
   * @param {object} model
   * @param {(value: Data) => value is T} model.is
   * @param {PropertyKey} [model.key]
   */
  constructor({ is, key }) {
    this[IS] = is
    this[PROPERTY_KEY] = key
  }

  [Symbol.toPrimitive]() {
    return SelectedVariable.getPropertyKey(this)
  }

  /**
   * @param {object} model
   * @param {Variable<Entity>|Entity} model.entity
   * @param {Variable<Attribute>|Attribute} model.attribute
   */
  bind(model) {
    return new DataAttribute({ ...model, schema: this })
  }

  /**
   * @param {Data} value
   * @returns {API.Result<T, Error>}
   */
  tryFrom(value) {
    return this[IS](value)
      ? { ok: value }
      : { error: new TypeError(`Unknown value type ${typeof value}`) }
  }

  static string() {
    return new StringSchema({
      /**
       * @param {unknown} value
       * @returns {value is string}
       */
      is: (value) => typeof value === 'string',
    })
  }
  static number() {
    return new NumberSchema({
      /**
       * @param {unknown} value
       * @returns {value is number}
       */
      is: (value) => typeof value === 'number',
    })
  }

  static boolean() {
    return new this({
      /**
       * @param {unknown} value
       * @returns {value is boolean}
       */
      is: (value) => typeof value === 'boolean',
    })
  }

  static _ = new Schema({
    /**
     * @param {unknown} _
     * @returns {_ is any}
     */
    is: (_) => true,
    key: '_',
  })
}

/**
 * @template {number} T
 * @extends {Schema<T>}
 * @implements {API.TryFrom<{ Self: T, Input: Data }>}
 */
class NumberSchema extends Schema {
  /**
   * @param {object} model
   * @param {Variable<Entity>|Entity} model.entity
   * @param {Variable<Attribute>|Attribute} model.attribute
   * @returns {NumberAttribute<T>}
   */
  bind(model) {
    return new NumberAttribute({ ...model, schema: this })
  }
}

/**
 * @template {string} T
 * @extends {Schema<T>}
 * @implements {API.TryFrom<{ Self: T, Input: Data }>}
 */
class StringSchema extends Schema {
  /**
   * @param {object} model
   * @param {Variable<Entity>|Entity} model.entity
   * @param {Variable<Attribute>|Attribute} model.attribute
   * @returns {StringAttribute<T>}
   */
  bind(model) {
    return new StringAttribute({ ...model, schema: this })
  }
}

/**
 * @template {Data} T
 * @extends {Schema<T>}
 */
class DataAttribute {
  /**
   * @param {object} model
   * @param {Variable<T>} model.schema
   * @param {Term} model.attribute
   * @param {Variable<Entity>|Entity} model.entity
   */
  constructor(model) {
    this.model = model
  }

  [Symbol.toPrimitive]() {
    return SelectedVariable.getPropertyKey(this)
  }

  /**
   * @param {Data} value
   * @returns {API.Result<T, Error>}
   */
  tryFrom(value) {
    return this.model.schema.tryFrom(value)
  }

  /**
   * @param {Data|Variable} value
   * @returns {Relation}
   */
  is(value) {
    return [this.model.entity, this.model.attribute, value]
  }

  /**
   * @returns {Relation}
   */
  get _() {
    return [this.model.entity, this.model.attribute, this]
  }

  /**
   * @param {number} value
   */
  not(value) {
    return [
      this.model.entity,
      this.model.attribute,
      new Schema({
        /**
         * @param {Data} x
         * @returns {x is number}
         */
        is: (x) => /** @type {number} */ (x) !== value,
      }),
    ]
  }
}

/**
 * @template {number} T
 * @extends {DataAttribute<T>}
 */
class NumberAttribute extends DataAttribute {
  /**
   * @param {number} value
   * @returns {Relation}
   */
  greaterThan(value) {
    return [
      this.model.entity,
      this.model.attribute,
      new Schema({
        /**
         * @param {Data} x
         * @returns {x is number}
         */
        is: (x) => /** @type {number} */ (x) > value,
      }),
    ]
  }

  /**
   * @param {number} value
   * @returns {Relation}
   */
  lessThan(value) {
    return [
      this.model.entity,
      this.model.attribute,
      new Schema({
        /**
         * @param {Data} x
         * @returns {x is number}
         */
        is: (x) => /** @type {number} */ (x) < value,
      }),
    ]
  }
}

/**
 * @template {string} T
 * @extends {DataAttribute<T>}
 */
class StringAttribute extends DataAttribute {
  /**
   * @template {string} Prefix
   * @param {Prefix} prefix
   * @returns {Relation}
   */
  startsWith(prefix) {
    return [
      this.model.entity,
      this.model.attribute,
      new Schema({
        /**
         * @param {Data} x
         * @returns {x is T & `${Prefix}${string}`}
         */
        is: (x) => typeof x === 'string' && x.startsWith(prefix),
      }),
    ]
  }
  /**
   * @template {string} Suffix
   * @param {Suffix} suffix
   * @returns {Relation}
   */
  endsWith(suffix) {
    return [
      this.model.entity,
      this.model.attribute,
      new Schema({
        /**
         * @param {Data} x
         * @returns {x is T & `${string}${Suffix}`}
         */
        is: (x) => typeof x === 'string' && x.endsWith(suffix),
      }),
    ]
  }
  /**
   * @param {string} chunk
   * @returns {Relation}
   */
  includes(chunk) {
    return [
      this.model.entity,
      this.model.attribute,
      new Schema({
        /**
         * @param {Data} x
         * @returns {x is T}
         */
        is: (x) => typeof x === 'string' && x.includes(chunk),
      }),
    ]
  }
}

/**
 * @template {Data} [T=Data]
 * @template {PropertyKey} [Key=PropertyKey]
 * @extends {Variable<T>}
 */
class SelectedVariable {
  static lastKey = 0

  /**
   * @param {Variable} variable
   * @returns {PropertyKey}
   */
  static getPropertyKey(variable) {
    const propertyKey = variable[PROPERTY_KEY]
    if (propertyKey) {
      return propertyKey
    } else {
      const bindingKey = `$${++this.lastKey}`
      variable[PROPERTY_KEY] = bindingKey
      return bindingKey
    }
  }

  /**
   * @param {object} source
   * @param {Key} source.key
   * @param {Variable<T>} source.schema
   */
  constructor({ key, schema }) {
    this.propertyKey = key
    this.schema = schema
  }

  /**
   * @param {Data} value
   */
  from(value) {
    return this.schema.tryFrom(value)
  }
}

/**
 * @template {Record<PropertyKey, Variable>} Attributes
 * @typedef {{[Key in keyof Attributes]: Attributes[Key] extends Variable<infer T> ? InferAttributeField<T> : never}} InferEntityFields
 */

/**
 * @template {Data} T
 * @typedef {T extends number ? NumberAttribute<T> :
 *           T extends string ? StringAttribute<T> :
 *           DataAttribute<T>} InferAttributeField
 */

/**
 * @template {Record<PropertyKey, Variable>} Attributes
 * @param {Attributes} attributes
 * @returns {{new(): EntityView<Attributes> & InferEntityFields<Attributes>}}
 */
export const entity = (attributes) =>
  // @ts-ignore
  class Entity extends EntityView {
    constructor() {
      super()
      for (const [key, variable] of entries(attributes)) {
        // @ts-ignore
        this[key] =
          variable instanceof Schema
            ? variable.bind({ entity: this, attribute: String(key) })
            : new DataAttribute({
                entity: this,
                attribute: String(key),
                schema: variable,
              })
      }
    }
  }

/**
 * @template {Record<PropertyKey, Variable>} Attributes
 * @extends {Schema<Entity>}
 */
class EntityView extends Schema {
  /**
   *
   * @param {unknown} value
   * @returns {value is Entity}
   */
  static isEntity(value) {
    switch (typeof value) {
      case 'string':
      case 'number':
        return true
      default:
        return false
    }
  }
  constructor() {
    super({ is: EntityView.isEntity })
  }
  /**
   * @param {Partial<{[Key in keyof Attributes]: Term}>} pattern
   * @returns {{where: Relation[]}}
   */
  match(pattern = {}) {
    const where = []
    const attributes = /** @type {Attributes} */ (this.valueOf())

    for (const [key, variable] of entries(attributes)) {
      const term = pattern[key] ?? variable
      // If there is a reference to an entity we include into relation, this
      // ensures that values for all entity attributes are aggregated.
      if (term instanceof EntityView) {
        where.push(...term.match().where)
      }

      where.push(/** @type {Relation} */ ([this, key, term]))
    }

    return { where }
  }

  /**
   * @param {Partial<{[Key in keyof Attributes]: Data|NewEntity}>} model
   * @returns {Iterable<Assert>}
   */
  *assert(model) {
    const attributes = /** @type {Attributes} */ (this.valueOf())
    for (const key of Object.keys(attributes)) {
      const value = model[key]
      if (value) {
        yield [/** @type {NewEntity} */ (model), key, value]
      }
    }
  }
}

const ID = Symbol.for('entity/id')

/**
 * Asserts certain facts about the entity.
 *
 * @typedef {Record<PropertyKey, Data> & {[ID]?: Entity}} EntityAssertion
 */

/**
 * @typedef {{[ID]: number}} NewEntity
 * @typedef {[entity: NewEntity, attribute: Attribute, value: Data|NewEntity]} Assert
 */

// /**
//  * @param {Database} db
//  * @param {Iterable<Fact|Iterable<Fact|Assert>>} assertions
//  */
// export const transact = (db, assertions) => {
//   const delta = { ...db, facts: [...db.facts] }
//   for (const assertion of assertions) {
//     const facts = isFact(assertion) ? [assertion] : assertion
//     for (const [entity, attribute, value] of facts) {
//       // New entities will not have an IDs associated with them which is why
//       // we are going to allocate new one. We also store it in the entity
//       // field so that we keep same ID across all associations on the entity.
//       if (typeof entity === 'object' && !entity[ID]) {
//         entity[ID] = delta.entityCount++
//       }

//       /** @type {Fact} */
//       const fact =
//         ID in /** @type {{[ID]?: number}} */ (entity)
//           ? [entity[ID], attribute, value]
//           : [entity, attribute, value]

//       delta.facts.push(fact)
//     }
//   }
// }

/**
 * @param {Database} db
 * @param {*} x
 */
const resolveID = (x) => {
  if (typeof x === 'object' && ID in x) {
    return x[ID]
  }
}

/**
 *
 * @param {unknown} x
 * @returns {x is Fact}
 */
const isFact = (x) => Array.isArray(x) && x.length === 3
