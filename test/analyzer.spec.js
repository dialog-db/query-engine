import * as Analyzer from '../src/analyzer.js'
import { Task, Link, $, Var, API, Memory } from 'datalogia'
import * as Inspector from './inspector.js'

/**
 * @type {import('entail').Suite}
 */
export const testAnalyzer = {
  'plans negation last': async (assert) => {
    const plan = Analyzer.rule({
      match: { child: $.child, uncle: $.uncle },
      when: {
        where: [
          { match: { the: 'semantic/type', of: $.child, is: 'child' } },
          { match: { the: 'relation/nephew', of: $.uncle, is: $.child } },
          {
            not: { match: { the: 'legal/guardian', of: $.child, is: $.uncle } },
          },
        ],
      },
    })
      .apply({ child: $.child, uncle: $.uncle })
      .prepare()

    assert.deepEqual(plan.toJSON(), {
      match: { child: $.child, uncle: $.uncle },
      rule: {
        match: { child: $.child, uncle: $.uncle },
        when: {
          where: [
            { match: { the: 'semantic/type', of: $.child, is: 'child' } },
            { match: { the: 'relation/nephew', of: $.uncle, is: $.child } },
            {
              not: {
                match: { the: 'legal/guardian', of: $.child, is: $.uncle },
              },
            },
          ],
        },
      },
    })
  },

  'negation considered across scopes': async (assert) => {
    const Allowed = /** @type {const} */ ({
      match: { this: $.x },
      when: {
        draft: [{ match: { the: 'status', of: $.x, is: 'draft' } }],
        activeOwner: [
          { match: { the: 'owner', of: $.x, is: $.user } },
          { not: { match: { the: 'status', of: $.user, is: 'blocked' } } },
        ],
      },
    })

    const plan = Analyzer.rule({
      match: { x: $.x },
      when: {
        where: [
          { match: { the: 'type', of: $.x, is: 'doc' } },
          { match: { this: $.x }, rule: Allowed },
        ],
      },
    })
      .apply({ x: $.y })
      .prepare()

    assert.deepEqual(plan.toJSON(), {
      match: { x: $.y },
      rule: {
        match: { x: $.x },
        when: {
          where: [
            { match: { the: 'type', of: $.x, is: 'doc' } },
            {
              match: { this: $.x },
              rule: {
                match: { this: $.x },
                when: {
                  draft: [
                    {
                      match: {
                        the: 'status',
                        of: $.x,
                        is: 'draft',
                      },
                    },
                  ],
                  activeOwner: [
                    {
                      match: {
                        the: 'owner',
                        of: $.x,
                        is: $.user,
                      },
                    },
                    {
                      not: {
                        match: {
                          the: 'status',
                          of: $.user,
                          is: 'blocked',
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    })
  },

  'variables get bound before used in some disjuncts': async (assert) => {
    const Allowed = /** @type {const} */ ({
      match: { this: $.x },
      when: {
        draft: [{ match: { the: 'status', of: $.x, is: 'draft' } }],
        activeOwner: [
          { match: { the: 'owner', of: $.x, is: $.user } },
          { not: { match: { the: 'status', of: $.user, is: 'blocked' } } },
        ],
      },
    })

    const Test = /** @type {const} */ ({
      match: { x: $.x },
      when: {
        where: [
          { match: { this: $.x }, rule: Allowed },
          { match: { the: 'type', of: $.x, is: 'doc' } },
          { match: { the: 'dept', of: $.user, is: 'eng' } },
        ],
      },
    })

    const plan = Analyzer.rule(Test).apply({ x: $.myX }).prepare()

    assert.deepEqual(plan.toJSON(), {
      match: { x: $.myX },
      rule: {
        match: { x: $.x },
        when: {
          where: [
            { match: { the: 'type', of: $.x, is: 'doc' } },
            {
              match: { this: $.x },
              rule: {
                match: { this: $.x },
                when: {
                  draft: [{ match: { the: 'status', of: $.x, is: 'draft' } }],
                  activeOwner: [
                    { match: { the: 'owner', of: $.x, is: $.user } },
                    {
                      not: {
                        match: { the: 'status', of: $.user, is: 'blocked' },
                      },
                    },
                  ],
                },
              },
            },
            { match: { the: 'dept', of: $.user, is: 'eng' } },
          ],
        },
      },
    })
  },

  'plans execution by cost': async (assert) => {
    const plan = Analyzer.rule({
      match: { title: $.title, actor: $.actor },
      when: {
        where: [
          { match: { the: 'movie/title', of: $.movie, is: $.title } },
          { match: { the: 'movie/cast', of: $.movie, is: $.actor } },
          {
            match: {
              the: 'person/name',
              of: $.actor,
              is: 'Arnold Schwarzenegger',
            },
          },
        ],
      },
    })
      .apply({ title: $.title, actor: $.actor })
      .prepare()

    assert.deepEqual(plan.toJSON(), {
      match: { title: $.title, actor: $.actor },
      rule: {
        match: { title: $.title, actor: $.actor },
        when: {
          where: [
            {
              match: {
                the: 'person/name',
                of: $.actor,
                is: 'Arnold Schwarzenegger',
              },
            },
            { match: { the: 'movie/cast', of: $.movie, is: $.actor } },
            { match: { the: 'movie/title', of: $.movie, is: $.title } },
          ],
        },
      },
    })
  },

  'nested Not considers outer scope': async (assert) => {
    const plan = Analyzer.rule({
      match: { doc: $.doc },
      when: {
        published: [
          { match: { the: 'type', of: $.doc, is: 'document' } },
          { match: { the: 'status', of: $.doc, is: 'published' } },
        ],
        draft: [
          { match: { the: 'type', of: $.doc, is: 'document' } },
          { match: { the: 'draft', of: $.doc, is: $.version } },
          {
            not: {
              match: { the: 'approved-by', of: $.version, is: $.reviewer },
            },
          },
          { match: { the: 'role', of: $.reviewer, is: 'editor' } },
        ],
      },
    })
      .apply({ doc: $.doc })
      .prepare()

    assert.deepEqual(
      plan.toJSON(),
      {
        match: { doc: $.doc },
        rule: {
          match: { doc: $.doc },
          when: {
            published: [
              { match: { the: 'type', of: $.doc, is: 'document' } },
              { match: { the: 'status', of: $.doc, is: 'published' } },
            ],
            draft: [
              { match: { the: 'type', of: $.doc, is: 'document' } },
              { match: { the: 'draft', of: $.doc, is: $.version } },
              { match: { the: 'role', of: $.reviewer, is: 'editor' } },
              {
                not: {
                  match: { the: 'approved-by', of: $.version, is: $.reviewer },
                },
              },
            ],
          },
        },
      },
      'Verify Not runs after reviewer role is established'
    )
  },

  'handles multiple Or branches with different locals': async (assert) => {
    const plan = Analyzer.rule({
      match: { x: $.x },
      when: {
        author: [
          { match: { the: 'author', of: $.x, is: $.author1 } },
          { match: { the: 'department', of: $.author1, is: 'eng' } },
        ],
        reviewer: [
          { match: { the: 'reviewer', of: $.x, is: $.reviewer2 } },
          { match: { the: 'level', of: $.reviewer2, is: 'senior' } },
        ],
      },
    })
      .apply({ x: $.doc })
      .prepare()

    assert.deepEqual(plan.toJSON(), {
      match: { x: $.doc },
      rule: {
        match: { x: $.x },
        when: {
          author: [
            { match: { the: 'department', of: $.author1, is: 'eng' } },
            { match: { the: 'author', of: $.x, is: $.author1 } },
          ],
          reviewer: [
            { match: { the: 'level', of: $.reviewer2, is: 'senior' } },
            { match: { the: 'reviewer', of: $.x, is: $.reviewer2 } },
          ],
        },
      },
    })
  },

  'handles multiple negations across scopes': async (assert) => {
    const plan = Analyzer.rule({
      match: { doc: $.doc },
      when: {
        branch1: [
          { match: { the: 'status', of: $.doc, is: 'draft' } },
          { not: { match: { the: 'deleted', of: $.doc, is: true } } },
          { match: { the: 'author', of: $.doc, is: $.user } },
        ],
        branch2: [
          { not: { match: { the: 'archived', of: $.team, is: true } } },
          { match: { the: 'status', of: $.doc, is: 'draft' } },
          { not: { match: { the: 'deleted', of: $.doc, is: true } } },
          { match: { the: 'team', of: $.doc, is: $.team } },
        ],
      },
    })
      .apply({ doc: $.document })
      .prepare()

    assert.deepEqual(
      plan.toJSON(),
      {
        match: { doc: $.document },
        rule: {
          match: { doc: $.doc },
          when: {
            branch1: [
              { match: { the: 'status', of: $.doc, is: 'draft' } },
              { not: { match: { the: 'deleted', of: $.doc, is: true } } },
              { match: { the: 'author', of: $.doc, is: $.user } },
            ],
            branch2: [
              { match: { the: 'status', of: $.doc, is: 'draft' } },
              { not: { match: { the: 'deleted', of: $.doc, is: true } } },
              { match: { the: 'team', of: $.doc, is: $.team } },
              { not: { match: { the: 'archived', of: $.team, is: true } } },
            ],
          },
        },
      },
      'Verify both negations run after their dependencies'
    )
  },

  'plans operations requiring shared variables': async (assert) => {
    const plan = Analyzer.rule({
      match: { x: $.x, user: $.user },
      when: {
        where: [
          { match: { the: 'role', of: $.user, is: 'admin' } },
          { match: { the: 'review', of: $.x, is: $.review } },
          { match: { the: 'type', of: $.x, is: 'doc' } },
          { match: { the: 'owner', of: $.x, is: $.user } },
          { match: { the: 'status', of: $.x, is: 'draft' } },
        ],
      },
    })
      .apply({ x: $.x, user: $.user })
      .prepare()

    assert.deepEqual(plan.toJSON(), {
      match: { x: $.x, user: $.user },
      rule: {
        match: { x: $.x, user: $.user },
        when: {
          where: [
            { match: { the: 'role', of: $.user, is: 'admin' } },
            { match: { the: 'type', of: $.x, is: 'doc' } },
            { match: { the: 'owner', of: $.x, is: $.user } },
            { match: { the: 'status', of: $.x, is: 'draft' } },
            { match: { the: 'review', of: $.x, is: $.review } },
          ],
        },
      },
    })
  },

  'handles Match clauses with variable dependencies': async (assert) => {
    const plan = Analyzer.rule({
      match: { doc: $.doc, count: $.count, size: $.size },
      when: {
        where: [
          { match: { of: $.count, is: $.size }, operator: 'text/length' },
          { match: { of: $.size, is: 1000 }, operator: '==' },
          { match: { the: 'word-count', of: $.doc, is: $.count } },
        ],
      },
    })
      .apply({ doc: $.doc, count: $.count, size: $.size })
      .prepare()

    assert.deepEqual(plan.toJSON(), {
      match: { doc: $.doc, count: $.count, size: $.size },
      rule: {
        match: { doc: $.doc, count: $.count, size: $.size },
        when: {
          where: [
            { match: { the: 'word-count', of: $.doc, is: $.count } },
            { match: { of: $.count, is: $.size }, operator: 'text/length' },
            { match: { of: $.size, is: 1000 }, operator: '==' },
          ],
        },
      },
    })
  },

  'fails if variable is not defined': async (assert) => {
    assert.throws(() => {
      const plan = Analyzer.rule({
        match: { doc: $.doc },
        when: {
          where: [
            { match: { the: 'status', of: $.doc, is: 'ready' } },
            { match: { of: $.user, is: 'admin' }, operator: '==' },
          ],
        },
      })
        .apply({ doc: $.doc })
        .prepare()
    }, /Unbound \?user variable referenced from { match: { of: \$.user, is: "admin" }, operator: "==" }/)
  },

  'terms in match affect planning': async (assert) => {
    const plan = Analyzer.rule({
      match: { user: $.user },
      when: {
        author: [
          { match: { the: 'draft', of: $.doc, is: $.version } },
          { match: { the: 'author', of: $.doc, is: $.user } },
        ],
        reviewer: [{ match: { the: 'reviewer', of: $.doc, is: $.user } }],
      },
    })
      .apply({ user: 1 })
      .prepare()

    assert.deepEqual(plan.toJSON(), {
      match: { user: 1 },
      rule: {
        match: { user: $.user },
        when: {
          author: [
            { match: { the: 'author', of: $.doc, is: $.user } },
            { match: { the: 'draft', of: $.doc, is: $.version } },
          ],
          reviewer: [{ match: { the: 'reviewer', of: $.doc, is: $.user } }],
        },
      },
    })
  },

  'fails on unknown variable reference': async (assert) => {
    assert.throws(() => {
      const plan = Analyzer.rule({
        match: { doc: $.doc },
        when: {
          branch1: [
            { match: { of: $.count, is: 100 }, operator: '==' },
            { match: { the: 'type', of: $.doc, is: 'counter' } },
          ],
          branch2: [{ match: { the: 'type', of: $.doc, is: 'doc' } }],
        },
      })
        .apply({ doc: $.doc })
        .prepare()
    }, /Unbound \?count variable referenced from { match: { of: \$.count, is: 100 }, operator: "==" }/)
  },

  'correctly maps variables across scopes': async (assert) => {
    const plan = Analyzer.rule({
      match: { x: $.x, y: $.y },
      when: {
        where: [
          { match: { the: 'type', of: $.y, is: 'person' } },
          { match: { the: 'name', of: $.y, is: $.x } },
        ],
      },
    })
      .apply({ x: $.y, y: $.x })
      .prepare()

    assert.deepEqual(plan.toJSON(), {
      match: { x: $.y, y: $.x },
      rule: {
        match: { x: $.x, y: $.y },
        when: {
          where: [
            { match: { the: 'type', of: $.y, is: 'person' } },
            { match: { the: 'name', of: $.y, is: $.x } },
          ],
        },
      },
    })
  },

  'throws if rule does not bind a variable': async (assert) => {
    assert.throws(
      () =>
        Analyzer.rule({
          match: { x: $.x, y: $.y },
          when: { where: [{ match: { the: 'type', of: $.y, is: 'person' } }] },
        })
          .apply({ x: $.output, y: $.input })
          .prepare(),
      /Rule case "where" does not bind variable \?x that rule matches as "x"/
    )
  },

  'throws if rule branch does not handle match variable': async (assert) => {
    assert.throws(
      () =>
        Analyzer.rule({
          match: { x: $.x, y: $.y },
          when: {
            base: [
              { match: { the: 'type', of: $.y, is: 'person' } },
              // Missing handling of $.x
            ],
          },
        })
          .apply({ x: $.output, y: $.input })
          .prepare(),
      /Rule case "base" does not bind variable \?x that rule matches as "x"/
    )
  },

  'recursive rule must have a non-recursive branch': async (assert) => {
    assert.throws(
      () =>
        Analyzer.rule({
          match: { x: $.x },
          when: {
            loop: [{ recur: { x: $.x } }],
          },
        })
          .apply({ x: $.who })
          .prepare(),
      /Recursive rule must have at least one non-recursive branch/
    )
  },

  'recursive rule must have non-recursive branch': async (assert) => {
    assert.throws(
      () =>
        Analyzer.rule({
          match: { x: $.x },
          when: {
            other: [
              { match: { of: $.x, with: 1, is: $.y }, operator: '+' },
              { recur: { x: $.y } },
            ],
            loop: [{ recur: { x: $.x } }],
          },
        })
          .apply({ x: 5 })
          .prepare(),
      /Recursive rule must have at least one non-recursive branch/
    )
  },

  'prefers efficient execution path based on bindings': async (assert) => {
    /**
     * @param {API.Term} x
     * @returns
     */
    const make = (x) =>
      Analyzer.rule({
        match: { x: $.x, y: $.y },
        when: {
          where: [
            { match: { of: $.type, is: 'type' }, operator: '==' },
            { match: { the: $.type, of: $.y, is: 'person' } },
            { match: { the: 'name', of: $.y, is: $.x } },
          ],
        },
      })
        .apply({ x, y: $.output })
        .prepare()

    assert.deepEqual(
      make($.input).toJSON(),
      {
        match: { x: $.input, y: $.output },
        rule: {
          match: { x: $.x, y: $.y },
          when: {
            where: [
              { match: { the: $.type, of: $.y, is: 'person' } },
              { match: { of: $.type, is: 'type' }, operator: '==' },
              { match: { the: 'name', of: $.y, is: $.x } },
            ],
          },
        },
      },
      'without bindings order remains same'
    )

    assert.deepEqual(
      make('John').toJSON(),
      {
        match: { x: 'John', y: $.output },
        rule: {
          match: { x: $.x, y: $.y },
          when: {
            where: [
              { match: { the: 'name', of: $.y, is: $.x } },
              { match: { the: $.type, of: $.y, is: 'person' } },
              { match: { of: $.type, is: 'type' }, operator: '==' },
            ],
          },
        },
      },
      'with bindings plans more more efficiently'
    )
  },

  'estimates costs across complex rule paths': async (assert) => {
    /**
     * @param {API.Term} person
     */
    const plan = (person) =>
      Analyzer.rule({
        match: { person: $.person },
        when: {
          manager: [{ match: { the: 'role', of: $.person, is: 'manager' } }],
          senior: [
            { match: { the: 'role', of: $.person, is: 'employee' } },
            { match: { the: 'level', of: $.person, is: 'senior' } },
          ],
        },
      })
        .apply({ person })
        .prepare()

    assert.ok(plan($.who).cost > plan('Alice').cost)
  },

  'ensures rule scope is independent from outer scope': async (assert) => {
    /**
     * @param {API.Term} result
     */
    const plan = (result) =>
      Analyzer.rule({
        match: { result: $.result },
        when: {
          ref: [
            {
              match: { of: $.result, is: 'reference' },
              operator: 'data/type',
            },
          ],
          else: [
            { match: { of: $.type, is: 'b' }, operator: '==' },
            { match: { the: $.type, of: $.x, is: 'b' } },
            { match: { the: 'value', of: $.result, is: $.x } },
          ],
        },
      })
        .apply({ result })
        .prepare()

    assert.deepEqual(plan('data').toJSON(), {
      match: { result: 'data' },
      rule: {
        match: { result: $.result },
        when: {
          ref: [
            { match: { of: $.result, is: 'reference' }, operator: 'data/type' },
          ],
          else: [
            { match: { the: 'value', of: $.result, is: $.x } },
            { match: { the: $.type, of: $.x, is: 'b' } },
            { match: { of: $.type, is: 'b' }, operator: '==' },
          ],
        },
      },
    })

    assert.throws(
      () => plan($.q),
      /Unbound \?result variable referenced from { match: { of: \$.result, is: "reference" }, operator: "data\/type" }/
    )
  },

  'handles rule variable mappings correctly': async (assert) => {
    assert.throws(
      () =>
        Analyzer.rule({
          match: { x: $.x, y: $.y },
          when: {
            where: [{ match: { this: $.x, than: $.y }, operator: '>' }],
          },
        })
          // @ts-expect-error - missing match for y
          .apply({ x: $.input })
          .prepare(),

      // Analyzer.from({
      //   match: { x: $.input },
      //   rule: {
      //     match: { x: $.x, y: $.y },
      //     when: [{ match: { this: $.x, than: $.y }, operator: '>' }],
      //   },
      // })
      /Rule application omits required parameter "y"/
    )
  },

  'rule output may be provided': async (assert) => {
    const rule = Analyzer.rule({
      match: { x: $.x, y: $.y },
      when: {
        where: [{ match: { of: $.x, by: 1, is: $.y }, operator: '-' }],
      },
    })

    const application = rule.apply({ x: $.outX, y: $.outY })

    assert.throws(() => {
      application.prepare()
    }, /Unbound \?x variable referenced from { match: { of: \$.x, by: 1, is: \$.y }, operator: "-" }/)

    assert.ok(rule.apply({ x: null, y: $.unbound }).prepare().toJSON())
    assert.ok(rule.apply({ x: 1, y: 2 }).prepare().toJSON())
  },

  'rule maps multi-variable input terms correctly': async (assert) => {
    const rule = Analyzer.rule({
      match: { x: $.a, y: $.b },
      when: {
        where: [
          {
            match: { of: $.a, with: $.b, is: $.result },
            operator: 'text/concat',
          },
        ],
      },
    })

    assert.deepEqual(rule.apply({ x: 1, y: 2 }).prepare().toJSON(), {
      match: { x: 1, y: 2 },
      rule: {
        match: { x: $.a, y: $.b },
        when: {
          where: [
            {
              match: { of: $.a, with: $.b, is: $.result },
              operator: 'text/concat',
            },
          ],
        },
      },
    })

    assert.throws(
      () => rule.apply({ x: 1, y: $.unbound }).prepare(),
      /Unbound \?b variable referenced/
    )

    assert.throws(
      () => rule.apply({ y: 1, x: $.unbound }).prepare(),
      /Unbound \?a variable referenced/
    )
  },

  'handles unified variables in rule case': async (assert) => {
    const Same = Analyzer.rule({
      match: { this: $.a, as: $.a },
    })

    assert.deepEqual(Same.apply({ this: 1, as: $.q }).prepare().toJSON(), {
      match: { this: 1, as: $.q },
      rule: {
        match: { this: $.a, as: $.a },
      },
    })

    assert.deepEqual(Same.apply({ this: $.q, as: 2 }).prepare().toJSON(), {
      match: { this: $.q, as: 2 },
      rule: {
        match: { this: $.a, as: $.a },
      },
    })

    assert.throws(
      () => Same.apply({ this: $.x, as: $.y }).prepare(),
      /Rule application requires binding for \?a/
    )
  },

  'unification + input': async (assert) => {
    const rule = Analyzer.rule({
      match: { a: $.a, b: $.a, c: $.c }, // Same variable $.a in both positions
      when: {
        where: [{ match: { of: $.a, is: $.c }, operator: '==' }],
      },
    })

    assert.ok(
      rule.apply({ a: 1, b: 1, c: $.unbound }).prepare().cost >=
        rule.apply({ a: 1, b: 1, c: 1 }).prepare().cost,
      'output cell can be omitted'
    )
  },

  'errors if rule branch references undefined variable': async (assert) => {
    const rule = Analyzer.rule({
      match: { x: $.x, y: $.y },
      when: {
        where: [
          {
            match: { of: $.z, with: $.y, is: $.x }, // $.z not in case
            operator: '+',
          },
        ],
      },
    })

    const match = rule.apply({ x: $.a, y: $.b })

    assert.throws(
      () => rule.apply({ x: 'a', y: 'b' }).prepare(),
      /Unbound \?z variable referenced from/
    )
  },

  'errors if deductive branch does not handle case variable': async (
    assert
  ) => {
    assert.throws(
      () =>
        Analyzer.rule({
          match: { x: $.x, y: $.y },
          when: {
            where: [
              { match: { the: 'type', of: $.x, is: 'person' } }, // Doesn't handle $.y
            ],
          },
        })
          .apply({ x: 'x', y: $.out })
          .prepare(),
      /Rule case "where" does not bind variable \?y that rule matches as "y"/
    )
  },

  'recursive rule must have when that binds all variables': async (assert) => {
    assert.throws(
      () =>
        Analyzer.rule({
          match: { this: $.value, from: $.from, to: $.to },
          when: {
            do: [{ match: { this: $.from, than: $.to }, operator: '<' }],
            while: [
              { match: { of: $.from, with: 1, is: $.inc }, operator: '+' },
              { match: { this: $.inc, than: $.to }, operator: '<' },
            ],
          },
        }),
      /does not bind variable \?value that rule matches as "this"/
    )
  },

  'allows output variables to be omitted from match': async (assert) => {
    const plan = Analyzer.rule({
      match: { x: $.x, y: $.y },
      when: {
        where: [{ match: { of: $.x, is: $.y }, operator: 'math/absolute' }],
      },
    })
      // @ts-expect-error - missing y
      .apply({ x: 'test' })
      .prepare()

    assert.ok(plan, 'Should allow omitting output variables')
  },

  'detects cycles between branches': async (assert) => {
    const rule = Analyzer.rule({
      match: { x: $.x, y: $.y },
      when: {
        where: [
          { match: { of: $.y, is: $.x }, operator: 'math/absolute' },
          { match: { of: $.x, with: 1, is: $.y }, operator: '+' },
        ],
      },
    })

    assert.throws(() => {
      rule.apply({ x: $.in, y: $.out }).prepare()
    }, /Unbound \?y variable referenced from { match: { of: \$.y, is: \$.x }, operator: "math\/absolute" }/)

    assert.deepEqual(
      rule.apply({ x: 1, y: $.out }).prepare().toJSON(),
      {
        match: { x: 1, y: $.out },
        rule: {
          match: { x: $.x, y: $.y },
          when: {
            where: [
              { match: { of: $.x, with: 1, is: $.y }, operator: '+' },
              { match: { of: $.y, is: $.x }, operator: 'math/absolute' },
            ],
          },
        },
      },
      'resolves cycle through x'
    )

    assert.deepEqual(
      rule.apply({ x: $.q, y: 1 }).prepare().toJSON(),
      {
        match: { x: $.q, y: 1 },
        rule: {
          match: { x: $.x, y: $.y },
          when: {
            where: [
              { match: { of: $.y, is: $.x }, operator: 'math/absolute' },
              { match: { of: $.x, with: 1, is: $.y }, operator: '+' },
            ],
          },
        },
      },
      'resolves cycle through y'
    )
  },

  'resoles cycles from application': async (assert) => {
    const rule = Analyzer.rule({
      match: { x: $.x, y: $.y },
      when: {
        where: [
          { match: { the: 'type', of: $.x, is: 'person' } }, // Outputs $.x
          { match: { of: $.x, with: 1, is: $.y }, operator: '+' }, // Uses $.x to produce $.y
          { match: { of: $.y, by: 1, is: $.x }, operator: '-' }, // Creates cycle by producing $.x again
        ],
      },
    })

    assert.deepEqual(rule.apply({ x: $.outX, y: $.outY }).prepare().toJSON(), {
      match: { x: $.outX, y: $.outY },
      rule: {
        match: { x: $.x, y: $.y },
        when: {
          where: [
            { match: { the: 'type', of: $.x, is: 'person' } },
            { match: { of: $.x, with: 1, is: $.y }, operator: '+' },
            { match: { of: $.y, by: 1, is: $.x }, operator: '-' },
          ],
        },
      },
    })
  },

  'unresolvable cycles': async (assert) => {
    const rule = Analyzer.rule({
      match: { is: $.is },
      when: {
        where: [
          { match: { of: $.x, with: 1, is: $.y }, operator: '+' },
          { match: { of: $.y, by: 1, is: $.x }, operator: '-' },
          { match: { of: $.x, is: $.is }, operator: '==' },
        ],
      },
    })

    assert.throws(
      () => rule.apply({ is: $.q }).prepare(),
      /Unbound \?x variable referenced from \{ match: { of: \$.x, with: 1, is: \$.y }, operator: "\+"/
    )
  },

  'only resolvable through unification': async (assert) => {
    const rule = Analyzer.rule({
      match: { is: $.is },
      when: {
        where: [
          { match: { of: $.x, with: 1, is: $.y }, operator: '+' },
          { match: { of: $.y, by: 1, is: $.x }, operator: '-' },
          {
            match: { this: $.x, as: $.is },
            rule: { match: { this: $.as, as: $.as }, when: {} },
          },
        ],
      },
    })

    assert.deepEqual(
      rule.apply({ is: 5 }).prepare().toJSON(),
      {
        match: { is: 5 },
        rule: {
          match: { is: $.is },
          when: {
            where: [
              {
                match: { this: $.x, as: $.is },
                rule: { match: { this: $.as, as: $.as } },
              },
              { match: { of: $.x, with: 1, is: $.y }, operator: '+' },
              { match: { of: $.y, by: 1, is: $.x }, operator: '-' },
            ],
          },
        },
      },
      'resolves cycle'
    )

    assert.throws(
      () => rule.apply({ is: $.q }).prepare(),
      /Rule application requires binding for \?as/
    )
  },

  'cycle in formula': async (assert) => {
    assert.throws(() => {
      Analyzer.rule({
        match: { x: $.x },
        when: {
          where: [
            {
              match: { of: $.x, with: 1, is: $.x },
              operator: '+',
            },
          ],
        },
      })
        .apply({ x: $.x })
        .prepare()
    }, /Variable .* cannot appear in both input and output of Match clause/)
  },

  'cycles between disjunctive branches are valid': async (assert) => {
    const plan = Analyzer.rule({
      match: { x: $.x, y: $.y },
      when: {
        branch1: [
          {
            match: { of: $.x, with: 1, is: $.y },
            operator: '+',
          },
        ],
        branch2: [{ match: { of: $.y, by: 1, is: $.x }, operator: '-' }],
      },
    })
      .apply({ x: 'x', y: 'y' })
      .prepare()

    assert.ok(plan, 'Rule should plan successfully')
  },

  'plans rule based on available bindings': async (assert) => {
    const plan = Analyzer.rule({
      match: { x: $.x },
      when: {
        where: [
          { match: { the: 'type', of: $.x, is: 'person' } },
          { match: { the: 'name', of: $.x, is: $.name } },
        ],
      },
    })
      .apply({ x: $.x })
      .prepare()

    assert.ok(plan, 'Should plan successfully')
  },

  'fails to plan when required inputs missing': async (assert) => {
    assert.throws(
      () =>
        Analyzer.rule({
          match: { x: $.x },
          when: {
            where: [
              {
                match: {
                  of: $.y, // y is not bound
                  with: 1,
                  is: $.x,
                },
                operator: '+',
              },
            ],
          },
        })
          .apply({ x: $.x })
          .prepare(),
      /Unbound \?y variable referenced from { match: { of: \$.y, with: 1, is: \$.x }, operator: "\+" }/
    )
  },

  'plans rule when inputs are bound': async (assert) => {
    const rule = Analyzer.rule({
      match: { x: $.x, y: $.y },
      when: {
        where: [
          // Needs $.x to produce $.y
          { match: { of: $.x, with: 1, is: $.y }, operator: '+' },
        ],
      },
    })

    const match = rule.apply({ x: $.in, y: $.out })

    assert.ok(
      rule.apply({ x: 'in', y: 'out' }).prepare(),
      'Plans when input is bound'
    )
    assert.throws(
      () => rule.apply({ x: $.x, y: 'out' }).prepare(),
      /Unbound \?x variable referenced from { match: { of: \$.x, with: 1, is: \$.y }, operator: "\+" }/
    )
  },

  'inflates rule cost based on recursion': async (assert) => {
    /**
     * @param {object} source
     * @param {API.Term} source.from
     * @param {API.Term} source.to
     * @returns
     */
    const Recursive = ({ from, to }) =>
      Analyzer.rule({
        match: { n: $.n, from: $.from, to: $.to },
        when: {
          do: [
            { match: { this: $.from, than: $.to }, operator: '<' },
            { match: { of: $.from, is: $.n }, operator: '==' },
          ],
          while: [
            { match: { this: $.from, than: $.to }, operator: '<' },
            { match: { of: $.from, with: 1, is: $.inc }, operator: '+' },
            { recur: { n: $.n, from: $.inc, to: $.to } },
          ],
        },
      })
        .apply({ n: $.n, from, to })
        .prepare()

    /**
     * @param {object} source
     * @param {API.Term} source.from
     * @param {API.Term} source.to
     * @returns
     */
    const Deductive = ({ from, to }) =>
      Analyzer.rule({
        match: { n: $.n, from: $.from, to: $.to },
        when: {
          base: [
            { match: { this: $.from, than: $.to }, operator: '<' },
            { match: { of: $.from, is: $.n }, operator: '==' },
          ],
          else: [
            { match: { of: $.from, with: 1, is: $.n }, operator: '+' },
            { match: { this: $.n, than: $.to }, operator: '<' },
          ],
        },
      })
        .apply({ n: $.n, from, to })
        .prepare()

    assert.ok(
      Recursive({ from: 0, to: 10 }).cost > Deductive({ from: 0, to: 10 }).cost,
      `Recursive rule should have higher cost ${
        Recursive({ from: 0, to: 10 }).cost
      } > ${Deductive({ from: 0, to: 10 }).cost}}`
    )
  },

  'considers variable mapping in cost estimation': async (assert) => {
    const rule = Analyzer.rule({
      match: { x: $.x },
      when: {
        where: [{ match: { of: $.x, with: 1, is: $.y }, operator: '+' }],
      },
    })

    assert.ok(
      rule.apply({ x: 1 }).prepare(),
      'Should plan with mapped variables'
    )
    assert.ok(
      rule.apply({ x: 'thing' }).prepare(),
      'Should plan with bound variables'
    )
  },

  'plans rule with no body': async (assert) => {
    const Same = Analyzer.rule({
      match: { this: $, as: $ },
    })

    const plan = Same.apply({ this: $.x, as: $.x }).plan({
      bindings: new Map([[$.x, 1]]),
      references: new Map(),
    })

    assert.ok(
      plan.cost < 1,
      'Empty rule should have very low cost as it just unifies variables'
    )

    assert.throws(
      () => Same.apply({ this: $.x, as: $.x }).prepare(),
      /Rule application requires binding for \?/
    )
  },

  'plan blank rules': async (assert) => {
    const Entity = Analyzer.rule({
      match: { this: $.this },
    })

    assert.throws(
      () => Entity.apply({ this: $.q }).prepare(),
      /Rule application requires binding for \?this/
    )
  },

  'compares iteration rule cost to against scan cost': async (assert) => {
    const Between = Analyzer.rule({
      match: {
        value: $.value,
        from: $.from,
        to: $.to,
      },
      when: {
        do: [
          { match: { this: $.from, than: $.to }, operator: '<' },
          { match: { of: $.from, is: $.value }, operator: '==' },
        ],
        while: [
          { match: { this: $.from, than: $.to }, operator: '<' },
          { match: { of: $.from, with: 1, is: $.next }, operator: '+' },
          { recur: { value: $.value, from: $.next, to: $.to } },
        ],
      },
    })

    const Scan = Analyzer.rule({
      match: { x: $.x },
      when: { where: [{ match: { the: 'type', of: $.x, is: 'document' } }] },
    })

    const between = Between.apply({ from: 0, to: 100, value: $.n }).prepare()

    const scan = Scan.apply({ x: $.x }).prepare()

    assert.ok(
      between.cost < scan.cost,
      `Between rule using only formula operations should be cheaper than a full scan ${between.cost} < ${scan.cost}`
    )
  },

  'estimates costs correctly for Case patterns': async (assert) => {
    // Helper to create a test case

    const select = Analyzer.rule({
      match: { the: $.attribute, of: $.entity, is: $.value },
      when: {
        where: [{ match: { the: $.attribute, of: $.entity, is: $.value } }],
      },
    })

    /**
     * @param {Omit<Required<API.Select>, 'this'>} terms
     * @param {Partial<API.Scope>} context
     */
    const testCost = (
      terms,
      { bindings = new Map(), references = new Map() } = {}
    ) =>
      select.apply(terms).plan({
        bindings,
        references,
      }).cost

    // Test EAV index cases
    const entityId = Link.of('test-entity')
    assert.ok(
      testCost({ the: 'type', of: entityId, is: $.value }) <
        testCost({ the: 'type', of: $.entity, is: $.value }),
      'Known entity should be cheaper than unknown'
    )

    // Test attribute selectivity
    assert.ok(
      testCost({ the: 'type', of: $.entity, is: $.value }) <
        testCost({ the: $.attribute, of: $.entity, is: $.value }),
      'Known attribute should be cheaper than unknown'
    )

    // Test value types
    assert.ok(
      testCost({ the: $.attribute, of: $.entity, is: entityId }) ==
        testCost({ the: $.attribute, of: $.entity, is: 'some-string' }),

      'Entity value should be as selective as string'
    )

    assert.ok(
      testCost({ the: $.attribute, of: $.entity, is: 'string' }) ==
        testCost({ the: $.attribute, of: $.entity, is: true }),
      'String should be as selective as boolean'
    )

    // Test index usage
    assert.ok(
      testCost({ the: 'type', of: entityId, is: $.value }) <
        testCost({ the: $.attribute, of: entityId, is: $.value }),
      'EAV index should be cheaper than scanning entity'
    )

    assert.ok(
      testCost({ the: 'type', of: $.entity, is: entityId }) <
        testCost({ the: $.attribute, of: $.entity, is: entityId }),
      'VAE index should be cheaper than scanning value'
    )

    // Test bound variables
    assert.ok(
      testCost({ the: 'type', of: entityId, is: $.value }) ==
        testCost(
          { the: 'type', of: $.entity, is: $.value },
          {
            bindings: new Map([[$.entity, entityId]]),
          }
        ),
      'Known entity should cost same as bound entity variable'
    )

    assert.ok(
      testCost({ the: 'type', of: $.entity, is: entityId }) ==
        testCost(
          { the: 'type', of: $.entity, is: $.value },
          {
            bindings: new Map([[$.value, 2]]),
          }
        ),
      'Known value should cost same as bound value variable'
    )
  },

  'test select circuit': (assert) => {
    const plan = Analyzer.rule({
      match: { x: $.x },
      when: {
        basic: [
          { match: { the: 'type', of: $.x, is: 'document' } },
          { match: { the: 'status', of: $.x, is: $.status } },
        ],
        advanced: [
          { match: { the: 'type', of: $.x, is: 'document' } },
          { match: { the: 'status', of: $.x, is: $.status } },
          { match: { the: 'author', of: $.x, is: $.author } },
        ],
      },
    })
      .apply({ x: $.x })
      .prepare()
  },

  'test correctly merges cost estimates': (assert) => {
    const rule = Analyzer.rule({
      match: { of: $.of },
      when: {
        where: [
          { match: { the: 'name', of: $.of, is: $.name } },
          { match: { of: $.name, is: 'string' }, operator: 'data/type' },
        ],
      },
    })

    const application = rule.apply({ of: $.subject })

    assert.ok(application.cost < Infinity)
  },

  'unblocks when referenced remote variable is unblocked': (assert) => {
    const plan = Analyzer.rule({
      match: { actual: $.actual, expect: $.expect },
      when: {
        where: [
          // Here we `$.expect` to be bound by the second conjunct.
          { match: { of: $.expect, is: 'actual' }, operator: '==' },
          // This sets a binding of the $.actual
          { match: { of: 'actual', is: $.actual }, operator: '==' },
        ],
      },
    })
      .apply({ actual: $.same, expect: $.same })
      .prepare()

    assert.deepEqual(plan.toJSON(), {
      match: { actual: $.same, expect: $.same },
      rule: {
        match: { actual: $.actual, expect: $.expect },
        when: {
          where: [
            { match: { of: 'actual', is: $.actual }, operator: '==' },
            { match: { of: $.expect, is: 'actual' }, operator: '==' },
          ],
        },
      },
    })
  },

  'negation references are inputs': (assert) => {
    assert.throws(() => {
      const plan = Analyzer.rule({
        match: { q: $.q },
        when: {
          where: [
            {
              not: { match: { the: 'status/ready', of: $.q } },
            },
          ],
        },
      })
        .apply({ q: $.q })
        .prepare()
    }, /Unbound \?q variable/)
  },

  'salary variable reuse test': async (assert) => {
    const Employee = /** @type {const} */ ({
      match: {
        this: $.this,
        name: $.name,
        salary: $.salary,
      },
      when: {
        where: [
          { match: { the: 'name', of: $.this, is: $.name } },
          { match: { the: 'salary', of: $.this, is: $.salary } },
        ],
      },
    })

    const Supervisor = Analyzer.rule({
      match: {
        employee: $.employee,
        supervisor: $.supervisor,
      },
      when: {
        where: [
          // Using the same wildcard variable $._ for two different salary parameters
          {
            match: { this: $.subordinate, name: $.employee, salary: $._ },
            rule: Employee,
          },
          { match: { the: 'supervisor', of: $.subordinate, is: $.manager } },
          {
            match: { this: $.manager, name: $.supervisor, salary: $._ },
            rule: Employee,
          },
        ],
      },
    })

    const plan = Supervisor.apply().prepare()
    assert.ok(
      plan,
      'Should successfully create a plan with reused wildcard variables'
    )
  },

  'formula input is required': (assert) => {
    assert.throws(() => {
      const plan = Analyzer.rule({
        match: { q: $.q },
        when: {
          where: [
            {
              match: { of: $.q, is: 'string' },
              operator: 'data/type',
            },
          ],
        },
      })
        .apply({ q: $.q })
        .prepare()
    }, /Unbound \?q variable referenced from { match: { of: \$.q, is: "string" }, operator: "data\/type" }/)
  },

  'discard variable still fails with required operators': (assert) => {
    const rule = Analyzer.rule({
      match: { type: $.type },
      when: {
        where: [
          // Using $._ as the required 'of' parameter - this should still fail
          { match: { of: $._, is: $.type }, operator: 'data/type' },
        ],
      },
    })

    assert.throws(() => {
      rule.apply({ type: 'string' }).prepare()
    }, /Unbound \?_ variable referenced from/)
  },

  'test select resolution': async (assert) => {
    const plan = Analyzer.rule({
      match: { person: $.person, name: $.name },
      when: {
        where: [{ match: { the: 'person/name', of: $.person, is: $.name } }],
      },
    })
      .apply({ person: $.q, name: 'Irakli' })
      .prepare()

    const source = Memory.create([
      {
        irakli: { 'person/name': 'Irakli' },
        zoe: { 'person/name': 'Zoe' },
      },
    ])
    const inspector = Inspector.from(source)

    assert.deepEqual(await plan.select({ from: inspector }), [
      { person: Link.of({ 'person/name': 'Irakli' }), name: 'Irakli' },
    ])

    assert.deepEqual(inspector.queries(), [
      { attribute: 'person/name', value: 'Irakli' },
    ])
  },
}
