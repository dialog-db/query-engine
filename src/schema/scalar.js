import * as API from '../api.js'
import { Callable } from './callable.js'
import * as Term from '../term.js'
import $ from '../$.js'
import * as Task from '../task.js'
import { rule, toJSON } from '../analyzer.js'
import * as Variable from '../variable.js'

/**
 * @template {API.ScalarDescriptor} Descriptor
 * @param {{ implicit?: API.InferSchemaType<Descriptor>, type: Descriptor}} [descriptor]
 * @returns {API.ScalarSchema<API.InferSchemaType<Descriptor>>}
 */
export const scalar = (descriptor) => {
  const type = typeOf(descriptor?.type ?? {})
  if (type === 'object') {
    return new Scalar(undefined, descriptor?.implicit)
  } else {
    return new Scalar(type, descriptor?.implicit)
  }
}

/**
 * @template {API.Scalar} [T=API.Scalar]
 * @implements {API.ScalarSchema<T>}
 */
export class Scalar extends Callable {
  /**
   * @param {API.TypeName} [type]
   * @param {T} [implicit]
   */
  constructor(type, implicit) {
    super(
      /**
       * @param {API.ScalarTerms<T>} term
       */
      (term) => this.match(term)
    )
    this.type = type
    this.implicitValue = implicit
  }
  /**
   * @param {API.ScalarTerms<T>} selector
   * @returns {API.MatchView<T>}
   */
  match(selector) {
    const { type } = this
    return type ?
        [
          /** @type {API.SystemOperator} */ ({
            match: {
              is: type,
              of: Term.is(selector) ? selector : selector.this,
            },
            operator: 'data/type',
          }),
        ]
      : []
  }

  get Scalar() {
    return this
  }

  /**
   * @param {T} value
   */
  implicit(value) {
    return new Scalar(this.type, value)
  }

  /**
   * @param {API.MatchFrame} bindings
   * @param {API.Term<T>} selector
   * @returns {T}
   */
  view(bindings, selector) {
    return Variable.is(selector) ?
        /** @type {T} */ (bindings.get(selector))
      : selector
  }
}

const ImplicitRule = /** @type {API.Deduction} */ ({
  match: { the: $.the, of: $.of, is: $.is, implicit: $.implicit },
  when: {
    Explicit: [{ match: { the: $.the, of: $.of, is: $.is } }],
    Implicit: [
      { not: { match: { the: $.the, of: $.of } } },
      { match: { of: $.implicit, is: $.is }, operator: '==' },
    ],
  },
})

/**
 * @template {API.The} The
 * @template Model
 * @template {API.Scalar} Implicit
 * @implements {API.Schema<{of: API.Entity, is: Model|Implicit }>}
 */
class ImplicitRelation extends Callable {
  /**
   * @param {The} the
   * @param {API.Schema<Model>} is
   * @param {API.Scalar} implicit
   */
  constructor(the, is, implicit) {
    super(
      /**
       * @type {API.Schema<{of: API.Entity, is: Model|Implicit }>['match']}
       */
      (source) => this.match(source)
    )
    this.the = the
    this.is = is
    this.implicit = implicit

    /** @type {API.SchemaTerms} */
    this.selector = {
      the,
      of: $.of,
      is: this.is.selector,
    }
  }

  /**
   * @param {API.MatchFrame} match
   * @param {API.SchemaTerms} selector
   * @returns {{of: API.Entity, is: Model|Implicit }}
   */
  view(match, selector) {
    return {
      of: /** @type {API.Entity} */ (match.get($.of)),
      is: this.is.view(match, /** @type {API.SchemaTerms} */ (selector.is)),
    }
  }

  /**
   *
   * @param {API.InferTypeTerms<{of: API.Entity, is: Model|Implicit }>} terms
   * @returns {API.MatchView<{of: API.Entity, is: Model|Implicit}>}
   */
  match({ of = $.of, is }) {
    return new RuleApplication(
      {
        the: this.the,
        of,
        is: /** @type {API.Term} */ (is ?? $.is),
        implicit: this.implicit,
      },
      ImplicitRule,
      this
    )
  }
}

/**
 * @template Model
 * @implements {API.MatchView<Model>}
 */
class RuleApplication {
  /**
   * @param {Record<string, API.Term>} terms
   * @param {API.Deduction} rule
   * @param {API.Schema<Model>} schema
   */
  constructor(terms, rule, schema) {
    this.terms = terms
    this.rule = rule
    this.schema = schema
  }

  *[Symbol.iterator]() {
    yield {
      match: this.terms,
      rule: this.rule,
    }
  }

  /**
   * @param {{ from: API.Querier }} terms
   */
  *query({ from }) {
    if (!this.plan) {
      this.plan = rule(this.rule).apply(this.terms).plan()
    }

    const selection = yield* this.plan.evaluate({
      source: from,
      selection: [new Map()],
    })

    const views = []
    for (const match of selection) {
      views.push(this.schema.view(match, this.terms))
    }

    return views
  }
}

/**
 * @param {API.TypeDescriptor} descriptor
 * @returns {API.TypeName|'object'}
 */
export const typeOf = (descriptor) => {
  switch (descriptor) {
    case null:
      return 'null'
    case globalThis.Boolean:
      return 'boolean'
    case String:
      return 'string'
    case Number:
      return 'int32'
    case BigInt:
      return 'int64'
    case Uint8Array:
      return 'bytes'
    default: {
      const type = /** @type {Record<string, unknown>} */ (descriptor)
      if (type.Null) {
        return 'null'
      } else if (type.Boolean) {
        return 'boolean'
      } else if (type.String) {
        return 'string'
      } else if (type.Int32) {
        return 'int32'
      } else if (type.Int64) {
        return 'int64'
      } else if (type.Float32) {
        return 'float32'
      } else if (type.Bytes) {
        return 'bytes'
      } else if (type.Reference) {
        return 'reference'
      } else {
        return 'object'
      }
    }
  }
}

/**
 * @param {API.Conjunct} source
 */
export const isNoop = (source) =>
  source.operator === '==' && source.match.is === undefined
