import * as API from './api.js'
import { Variable, default as $, variable } from './scope.js'
import * as Term from './term.js'
import * as Bindings from './bindings.js'
import * as Constant from './constant.js'
import { rule } from './analyzer.js'
import * as Task from './task.js'

/**
 * @template {API.Constant} [T=API.Constant]
 * @implements {API.Variable<T>}
 */
class Scalar extends Variable {
  /**
   * @param {API.TypeName} type
   * @param {string|symbol} [name]
   */
  constructor(type, name) {
    super(Variable.id++, name)
    this.type = type
  }

  /**
   * @param {{this?:API.Term<T>}} terms
   * @returns {API.Constraint}
   */
  match(terms) {
    return /** @type {API.SystemOperator} */ ({
      match: { of: terms.this ?? this, is: this.type },
      operator: 'data/type',
    })
  }
}

/**
 * @extends {Scalar<null>}
 */
class Null extends Scalar {
  /**
   * @param {string|symbol} [name]
   */
  constructor(name) {
    super('null', name)
  }

  Null = {}
}

/**
 * @extends {Scalar<boolean>}
 */
class Boolean extends Scalar {
  /**
   * @param {string|symbol} [name]
   */
  constructor(name) {
    super('boolean', name)
  }

  Boolean = {}
}
/**
 * @extends {Scalar<string>}
 */
class Text extends Scalar {
  /**
   * @param {string|symbol} [name]
   */
  constructor(name) {
    super('string', name)
  }

  String = {}
}

/**
 * @extends {Scalar<API.Int32>}
 */
class Int32 extends Scalar {
  /**
   * @param {string|symbol} [name]
   */
  constructor(name) {
    super('int32', name)
  }

  Int32 = {}
}

/**
 * @extends {Scalar<API.Int64>}
 */
class Int64 extends Scalar {
  /**
   * @param {string|symbol} [name]
   */
  constructor(name) {
    super('int64', name)
  }

  Int64 = {}
}

/**
 * @extends {Scalar<API.Float32>}
 */
class Float32 extends Scalar {
  /**
   * @param {string|symbol} [name]
   */
  constructor(name) {
    super('float32', name)
  }

  Float32 = {}
}

/**
 * @extends {Scalar<Uint8Array>}
 */
class Bytes extends Scalar {
  /**
   * @param {string|symbol} [name]
   */
  constructor(name) {
    super('bytes', name)
  }

  Bytes = {}
}

export const string = () => new Text()
export const integer = () => new Int32()
export const int32 = () => new Int32()
export const int64 = () => new Int64()
export const boolean = () => new Boolean()
export const float32 = () => new Float32()
export const decimal = () => new Float32()
export const bytes = () => new Bytes()
export const nil = () => new Null()

/**
 * @template {Record<string, API.Model>} [Schema={}]
 * @param {Schema} [schema]
 * @returns {Entity<Schema>}
 */
export const entity = (schema = /** @type {Schema} */ ({})) =>
  new Entity(schema)

/**
 * @template {API.ObjectDescriptor} Descriptor
 * @template {string} [Label=keyof Descriptor & string]
 * @param {Descriptor} descriptor
 * @returns {API.EntitySchema<API.InferSchemaType<Descriptor>, Descriptor, Label>}
 */
export const schema = (descriptor) =>
  /** @type {API.EntitySchema<API.InferSchemaType<Descriptor>, Descriptor, Label>} */ (
    Entity.build(descriptor)
  )

/**
 * @param {API.TypeDescriptor} descriptor
 * @returns {API.EntityMember}
 */
const build = (descriptor) => {
  if (descriptor === null) {
    return new NullSchema()
  } else if (globalThis.Boolean === descriptor) {
    return new BooleanSchema()
  } else if (descriptor === String) {
    return new StringSchema()
  } else if (descriptor === Number) {
    return new IntegerSchema()
  } else if (descriptor === BigInt) {
    return new BigIntSchema()
  } else if (descriptor === Uint8Array) {
    return new BytesSchema()
  } else {
    return /** @type {API.EntitySchema} */ (descriptor).Object ?
        /** @type {API.EntitySchema} */ (descriptor)
      : Entity.build(/** @type {API.ObjectDescriptor} */ (descriptor))
  }
}

/**
 * @template Model
 */
class Entity {
  /**
   * @template {API.ObjectDescriptor} Descriptor
   * @param {API.ObjectDescriptor} source
   * @returns {API.EntitySchema}
   */
  static build(source) {
    const [[label, descriptor], ...rest] = Object.entries(source)
    if (rest.length > 0) {
      throw new TypeError(
        `Object descriptor may contain only one top level key`
      )
    }

    /** @type {API.Conjunct[]} */
    const when = []

    /** @type {API.Variable<API.Entity>} */
    const of = $[`${label}{}`]
    /** @type {Record<string, API.Variable>} */
    const match = { this: of }

    /** @type {API.SchemaVariables} */
    const variables = { this: of }

    /** @type {Record<string, API.EntityMember>} */
    const members = {}

    for (const [name, member] of Object.entries(descriptor)) {
      const the = `${label}/${name}`
      const is = $[name]
      const schema = build(member)

      members[name] = schema
      match[name] = is
      when.push({ match: { the, of, is } })

      // If member is an entity we need to copy variables and combine the match
      if (schema.Object) {
        // We namespace member variables to avoid conflicts when same type is
        // used on several members.
        for (const key of Object.keys(schema.rule.match)) {
          if (key !== 'this') {
            const id = `${name}.${key}`
            match[id] = $[id]
          }
        }

        // Creates namespaces variables for all the members variables so they
        // will align with variables we added to the `match`.
        variables[name] = withPrefix(name, schema.variables)
        when.push(schema.match(variables[name]))
      }
      // If member is a scalar we add variables in both match and to the
      // variables
      else {
        variables[name] = is
        when.push(schema.match(is))
      }
    }

    /**
     * @extends {Entity<API.InferSchemaType<Descriptor>>}
     */
    const schema = class extends Entity {
      static label = label
      static members = members
      static variables = variables

      static Object = source

      static rule = {
        match,
        when: /** @type {any} */ (when),
      }
    }

    return /** @type {any} */ (schema)
  }

  /**
   * @template Model
   * @param {Model} model
   */
  static new(model) {
    return model
  }
  /** @type {string[]} */
  static at = []
  static label = ''

  /** @type {API.Deduction} */
  static rule

  /** @type {API.SchemaVariables} */
  static variables

  /** @type {Record<string, API.EntityMember>} */
  static members = {}

  static Object = {}

  /**
   * @param {API.TermTree} terms
   * @returns {API.MatchRule}
   */
  static match(terms) {
    /** @type {Record<string, API.Term>} */
    const match = { ...this.rule.match }
    for (const [name, term] of iterateTerms(terms)) {
      match[name] = term
    }

    return {
      match,
      rule: this.rule,
    }
  }

  /**
   * @param {Record<string, API.Term>} terms
   */
  static not(terms) {
    return { not: this.match(terms) }
  }

  /**
   * @param {API.TermTree & { from: API.Querier }} terms
   */
  static *query({ from, ...terms }) {
    const { match } = this.match(terms)
    const query = rule(this.rule).apply(match).plan()

    // We set up the bindings for the terms that have being provided
    // as part of the query as those will not be set by the rule application.
    /** @type {API.Bindings} */
    let bindings = {}
    for (const [key, term] of Object.entries(match)) {
      const variable = this.rule.match[key]
      if (Constant.is(term)) {
        bindings = Bindings.set(bindings, variable, term)
      }
    }

    const selection = yield* query.evaluate({
      source: from,
      selection: [bindings],
    })

    const results = []
    for (const match of selection) {
      results.push(this.view(match, this.variables))
    }

    return results
  }

  /**
   * @param {API.Bindings} bindings
   * @param {API.SchemaVariables} variables
   */
  static view(bindings, variables) {
    /** @type {Record<string, any>} */
    const model = {
      this: Bindings.get(bindings, variables.this),
    }

    for (const [key, member] of Object.entries(this.members)) {
      model[key] =
        member.Object ?
          member.view(
            bindings,
            /** @type {API.SchemaVariables} */ (variables[key])
          )
        : Bindings.get(bindings, /** @type {API.Variable} */ (variables[key]))
    }

    return this.new(model)
  }

  /**
   * @param {API.TermTree & { from: API.Querier }} source
   */
  static select(source) {
    return Task.perform(this.query(source))
  }

  /**
   * @template Model
   * @param {(variables: API.InferTypeVariables<Model>) => Iterable<API.Conjunct>} derive
   */
  static when(derive) {
    const when = [
      ...derive(/** @type {API.InferTypeVariables<Model>} */ (this.variables)),
    ]

    // Add all the type constraints for the object members
    for (const [key, schema] of Object.entries(this.members)) {
      when.push(schema.match(/** @type {any} */ (this.variables[key])))
    }

    const { label, members, variables, at, Object: source, rule } = this

    /**
     * @extends {Entity<Model>}
     */
    class Rule extends Entity {
      static label = label
      static at = at
      static members = members
      static variables = variables

      static Object = source

      static rule = {
        ...rule,
        /** @type {API.Every} */
        when: /** @type {any} */ (when),
      }
    }

    return Rule
  }

  /**
   * @param {Model} model
   */
  constructor(model) {
    Object.assign(this, model)
  }

  toJSON() {
    /** @type {Record<string, {}|null>} */
    const json = {}
    for (const [key, member] of Object.entries(this)) {
      if (Constant.is(member)) {
        json[key] = Constant.toJSON(member)
      } else {
        json[key] = toJSON(member)
      }
    }

    return json
  }
}

/**
 * @param {any} object
 * @returns
 */
const toJSON = (object) =>
  typeof object?.toJSON === 'function' ? object.toJSON() : object

/**
 * @param {API.TermTree} terms
 * @returns {Iterable<[string, API.Term]>}
 */
function* iterateTerms(terms, prefix = '') {
  for (const [key, term] of Object.entries(terms)) {
    if (Term.is(term)) {
      const path =
        prefix === '' ? key
        : key === 'this' ? prefix
        : `${prefix}.${key}`
      yield [path, term]
    } else {
      yield* iterateTerms(term, prefix === '' ? key : `${prefix}.${key}`)
    }
  }
}

/**
 * @param {string} prefix
 * @param {API.SchemaVariables} object
 * @returns {API.SchemaVariables}
 */
const withPrefix = (prefix, object) => {
  const prefixed = /** @type {API.SchemaVariables} */ ({})
  for (const [key, variable] of Object.entries(object)) {
    if (Term.is(variable)) {
      prefixed[key] = $[key === 'this' ? prefix : `${prefix}.${key}`]
    } else {
      prefixed[key] = withPrefix(`${prefix}.${key}`, variable)
    }
  }
  return prefixed
}

/**
 * @template {API.Constant} [T=API.Constant]
 */
class ScalarSchema {
  /**
   * @param {API.TypeName} type
   */
  constructor(type) {
    this.type = type
  }
  /**
   * @param {API.Term<T>} term
   * @returns {API.Constraint}
   */
  match(term) {
    return /** @type {API.SystemOperator} */ ({
      match: { of: term, is: this.type },
      operator: 'data/type',
    })
  }
}

class NullSchema extends ScalarSchema {
  constructor() {
    super('null')
  }
}

class BooleanSchema extends ScalarSchema {
  constructor() {
    super('boolean')
  }
}

class StringSchema extends ScalarSchema {
  constructor() {
    super('string')
  }
}

class IntegerSchema extends ScalarSchema {
  constructor() {
    super('int32')
  }
}

class BigIntSchema extends ScalarSchema {
  constructor() {
    super('int64')
  }
}

class BytesSchema extends ScalarSchema {
  constructor() {
    super('bytes')
  }
}

/**
 * Rule that checks that given entity has a value of a given type under a given
 * attribute.
 */
const TypedValue = /** @type {const} */ ({
  match: {
    the: $.the,
    of: $.of,
    is: $.is,
    type: $.type,
  },
  when: [
    { match: { the: $.the, of: $.of, is: $.is } },
    { match: { of: $.is, is: $.type }, operator: 'data/type' },
  ],
})

const ImplicitTypedValue = /** @type {const} */ ({
  match: {
    the: $.the,
    of: $.of,
    is: $.is,
    implicit: $.implicit,
    type: $.type,
  },
  when: {
    explicit: [
      { match: { the: $.the, of: $.of, is: $.is } },
      { match: { of: $.is, is: $.type }, operator: 'data/type' },
    ],
    implicit: [
      { not: { match: { the: $.the, of: $.of, is: $._ } } },
      { match: { of: $.implicit, is: $.is }, operator: '==' },
    ],
  },
})
