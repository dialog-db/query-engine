import * as Analyzer from '../src/analyzer.js'
import { Task, Link, $, Var, API } from 'datalogia'

/**
 * @type {import('entail').Suite}
 */
export const testAnalyzer = {
  'plans negation last': async (assert) => {
    const plan = Analyzer.plan({
      match: { child: $.child, uncle: $.uncle },
      rule: {
        match: { child: $.child, uncle: $.uncle },
        when: [
          { match: { the: 'semantic/type', of: $.child, is: 'child' } },
          { match: { the: 'relation/nephew', of: $.uncle, is: $.child } },
          {
            not: { match: { the: 'legal/guardian', of: $.child, is: $.uncle } },
          },
        ],
      },
    })

    assert.deepEqual(plan.toJSON(), {
      match: { child: $.child, uncle: $.uncle },
      rule: {
        match: { child: $.child, uncle: $.uncle },
        when: [
          { match: { the: 'semantic/type', of: $.child, is: 'child' } },
          { match: { the: 'relation/nephew', of: $.uncle, is: $.child } },
          {
            not: {
              match: { the: 'legal/guardian', of: $.child, is: $.uncle },
            },
          },
        ],
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

    const plan = Analyzer.plan({
      match: { x: $.y },
      rule: {
        match: { x: $.x },
        when: [
          { match: { the: 'type', of: $.x, is: 'doc' } },
          { match: { this: $.x }, rule: Allowed },
        ],
      },
    })

    assert.deepEqual(plan.toJSON(), {
      match: { x: $.y },
      rule: {
        match: { x: $.x },
        when: [
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
      when: [
        { match: { this: $.x }, rule: Allowed },
        { match: { the: 'type', of: $.x, is: 'doc' } },
        { match: { the: 'dept', of: $.user, is: 'eng' } },
      ],
    })

    const plan = Analyzer.plan({
      match: { x: $.myX },
      rule: Test,
    })

    assert.deepEqual(plan.toJSON(), {
      match: { x: $.myX },
      rule: {
        match: { x: $.x },
        when: [
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
    })
  },

  'plans execution by cost': async (assert) => {
    const plan = Analyzer.plan({
      match: { title: $.title, actor: $.actor },
      rule: {
        match: { title: $.title, actor: $.actor },
        when: [
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

    assert.deepEqual(plan.toJSON(), {
      match: { title: $.title, actor: $.actor },
      rule: {
        match: { title: $.title, actor: $.actor },
        when: [
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
    })
  },

  'nested Not considers outer scope': async (assert) => {
    const plan = Analyzer.plan({
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
            {
              not: {
                match: { the: 'approved-by', of: $.version, is: $.reviewer },
              },
            },
            { match: { the: 'role', of: $.reviewer, is: 'editor' } },
          ],
        },
      },
    })

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
    const plan = Analyzer.plan({
      match: { x: $.doc },
      rule: {
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
      },
    })

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
    const plan = Analyzer.plan({
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
            { not: { match: { the: 'archived', of: $.team, is: true } } },
            { match: { the: 'status', of: $.doc, is: 'draft' } },
            { not: { match: { the: 'deleted', of: $.doc, is: true } } },
            { match: { the: 'team', of: $.doc, is: $.team } },
          ],
        },
      },
    })

    assert.deepEqual(
      plan.toJSON(),
      {
        match: { doc: $.document },
        rule: {
          match: { doc: $.doc },
          when: {
            branch1: [
              { match: { the: 'status', of: $.doc, is: 'draft' } },
              { match: { the: 'author', of: $.doc, is: $.user } },
              { not: { match: { the: 'deleted', of: $.doc, is: true } } },
            ],
            branch2: [
              { match: { the: 'status', of: $.doc, is: 'draft' } },
              { match: { the: 'team', of: $.doc, is: $.team } },
              { not: { match: { the: 'archived', of: $.team, is: true } } },
              { not: { match: { the: 'deleted', of: $.doc, is: true } } },
            ],
          },
        },
      },
      'Verify both negations run after their dependencies'
    )
  },
  'plans operations requiring shared variables': async (assert) => {
    const plan = Analyzer.plan({
      match: { x: $.x, user: $.user },
      rule: {
        match: { x: $.x, user: $.user },
        when: [
          { match: { the: 'role', of: $.user, is: 'admin' } },
          { match: { the: 'review', of: $.x, is: $.review } },
          { match: { the: 'type', of: $.x, is: 'doc' } },
          { match: { the: 'owner', of: $.x, is: $.user } },
          { match: { the: 'status', of: $.x, is: 'draft' } },
        ],
      },
    })

    assert.deepEqual(plan.toJSON(), {
      match: { x: $.x, user: $.user },
      rule: {
        match: { x: $.x, user: $.user },
        when: [
          { match: { the: 'role', of: $.user, is: 'admin' } },
          { match: { the: 'type', of: $.x, is: 'doc' } },
          { match: { the: 'owner', of: $.x, is: $.user } },
          { match: { the: 'status', of: $.x, is: 'draft' } },
          { match: { the: 'review', of: $.x, is: $.review } },
        ],
      },
    })
  },

  'handles Match clauses with variable dependencies': async (assert) => {
    const plan = Analyzer.plan({
      match: { doc: $.doc, count: $.count, size: $.size },
      rule: {
        match: { doc: $.doc, count: $.count, size: $.size },
        when: [
          { match: { of: $.count, is: $.size }, operator: 'text/length' },
          { match: { of: $.size, is: 1000 }, operator: '==' },
          { match: { the: 'word-count', of: $.doc, is: $.count } },
        ],
      },
    })

    assert.deepEqual(plan.toJSON(), {
      match: { doc: $.doc, count: $.count, size: $.size },
      rule: {
        match: { doc: $.doc, count: $.count, size: $.size },
        when: [
          { match: { the: 'word-count', of: $.doc, is: $.count } },
          { match: { of: $.count, is: $.size }, operator: 'text/length' },
          { match: { of: $.size, is: 1000 }, operator: '==' },
        ],
      },
    })
  },

  'fails if variable is not defined': async (assert) => {
    assert.throws(() => {
      const plan = Analyzer.plan({
        match: { doc: $.doc },
        rule: {
          match: { doc: $.doc },
          when: [
            { match: { the: 'status', of: $.doc, is: 'ready' } },
            { match: { of: $.user, is: 'admin' }, operator: '==' },
          ],
        },
      })
    }, /Unbound \?user variable referenced from { match: { of: \$.user, is: "admin" }, operator: "==" }/)
  },

  'terms in match affect planning': async (assert) => {
    const plan = Analyzer.plan({
      match: { user: 1 },
      rule: {
        match: { user: $.user },
        when: {
          author: [
            { match: { the: 'draft', of: $.doc, is: $.version } },
            { match: { the: 'author', of: $.doc, is: $.user } },
          ],
          reviewer: [{ match: { the: 'reviewer', of: $.doc, is: $.user } }],
        },
      },
    })

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
      const plan = Analyzer.plan({
        match: { doc: $.doc },
        rule: {
          match: { doc: $.doc },
          when: {
            branch1: [
              { match: { of: $.count, is: 100 }, operator: '==' },
              { match: { the: 'type', of: $.doc, is: 'counter' } },
            ],
            branch2: [{ match: { the: 'type', of: $.doc, is: 'doc' } }],
          },
        },
      })
    }, /Unbound \?count variable referenced from { match: { of: \$.count, is: 100 }, operator: "==" }/)
  },

  'correctly maps variables across scopes': async (assert) => {
    const plan = Analyzer.plan({
      match: { x: $.y, y: $.x },
      rule: {
        match: { x: $.x, y: $.y },
        when: [
          { match: { the: 'type', of: $.y, is: 'person' } },
          { match: { the: 'name', of: $.y, is: $.x } },
        ],
      },
    })

    assert.deepEqual(plan.toJSON(), {
      match: { x: $.y, y: $.x },
      rule: {
        match: { x: $.x, y: $.y },
        when: [
          { match: { the: 'type', of: $.y, is: 'person' } },
          { match: { the: 'name', of: $.y, is: $.x } },
        ],
      },
    })
  },
  'throws if rule deductive branch does not handle case variable': async (
    assert
  ) => {
    assert.throws(
      () =>
        Analyzer.plan({
          match: { x: $.output, y: $.input },
          rule: {
            match: { x: $.x, y: $.y },
            when: [{ match: { the: 'type', of: $.y, is: 'person' } }],
          },
        }),
      /Rule case "when" does not bind variable \?x that rule matches as "x"/
    )
  },
  'throws if rule branch does not handle match variable': async (assert) => {
    assert.throws(
      () =>
        Analyzer.plan({
          match: { x: $.output, y: $.input },
          rule: {
            match: { x: $.x, y: $.y },
            when: {
              base: [
                { match: { the: 'type', of: $.y, is: 'person' } },
                // Missing handling of $.x
              ],
            },
          },
        }),
      /Rule case "base" does not bind variable \?x that rule matches as "x"/
    )
  },
  'throws if rule inductive branch does not handle match variable': async (
    assert
  ) => {
    assert.throws(
      () =>
        Analyzer.plan({
          match: { x: $.output, y: $.input },
          rule: {
            match: { x: $.x, y: $.y },
            when: [{ match: { the: 'link', of: $.x, is: $.y } }],
            repeat: { x: $.x, y: $.z },
            while: [{ match: { the: 'link', of: $.x, is: $.z } }],
          },
        }),
      /Rule case "while" does not bind variable \?y that rule matches as "y"/
    )
  },

  'rule must have non-inductive branch': async (assert) => {
    assert.throws(
      () =>
        Analyzer.plan({
          match: { x: $.who },
          // @ts-expect-error - missing when branch
          rule: {
            match: { x: $.x },
            repeat: { x: $.inc },
            while: [
              {
                match: { of: $.x, with: 1, is: $.inc },
                operator: '+',
              },
            ],
          },
        }),
      /Inductive rule must have "when" property establishing base case of recursion/
    )
  },
  'prefers efficient execution path based on bindings': async (assert) => {
    /**
     * @param {API.Term} x
     * @returns
     */
    const make = (x) =>
      Analyzer.plan({
        match: { x, y: $.output },
        rule: {
          match: { x: $.x, y: $.y },
          when: [
            { match: { of: $.type, is: 'type' }, operator: '==' },
            { match: { the: $.type, of: $.y, is: 'person' } },
            { match: { the: 'name', of: $.y, is: $.x } },
          ],
        },
      })

    assert.deepEqual(
      make($.input).toJSON(),
      {
        match: { x: $.input, y: $.output },
        rule: {
          match: { x: $.x, y: $.y },
          when: [
            { match: { the: $.type, of: $.y, is: 'person' } },
            { match: { of: $.type, is: 'type' }, operator: '==' },
            { match: { the: 'name', of: $.y, is: $.x } },
          ],
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
          when: [
            { match: { the: 'name', of: $.y, is: $.x } },
            { match: { the: $.type, of: $.y, is: 'person' } },
            { match: { of: $.type, is: 'type' }, operator: '==' },
          ],
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
      Analyzer.plan({
        match: { person },
        rule: {
          match: { person: $.person },
          when: {
            manager: [{ match: { the: 'role', of: $.person, is: 'manager' } }],
            senior: [
              { match: { the: 'role', of: $.person, is: 'employee' } },
              { match: { the: 'level', of: $.person, is: 'senior' } },
            ],
          },
        },
      })

    assert.ok(plan($.who).cost > plan('Alice').cost)
  },
  'ensures rule scope is independent from outer scope': async (assert) => {
    /**
     * @param {API.Term} result
     */
    const plan = (result) =>
      Analyzer.plan({
        match: { result },
        rule: {
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
        },
      })

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
        Analyzer.plan({
          // @ts-expect-error - missing match for y
          match: { x: $.input },
          rule: {
            match: { x: $.x, y: $.y },
            when: [{ match: { this: $.x, than: $.y }, operator: '>' }],
          },
        }),
      /Rule application omits required binding for "y"/
    )
  },

  'rule output may be provided': async (assert) => {
    const rule = Analyzer.rule({
      match: { x: $.x, y: $.y },
      when: [{ match: { of: $.x, by: 1, is: $.y }, operator: '-' }],
    })

    const application = rule.apply({ x: $.outX, y: $.outY })

    assert.throws(() => {
      application.plan()
    }, /Unbound \?x variable referenced from { match: { of: \$.x, by: 1, is: \$.y }, operator: "-" }/)

    assert.ok(rule.apply({ x: null, y: $.unbound }).plan().toJSON())
    assert.ok(rule.apply({ x: 1, y: 2 }).plan().toJSON())
  },

  'rule maps multi-variable input terms correctly': async (assert) => {
    const rule = Analyzer.rule({
      match: { x: $.a, y: $.b },
      when: [
        {
          match: { of: $.a, with: $.b, is: $.result },
          operator: 'text/concat',
        },
      ],
    })

    assert.deepEqual(rule.apply({ x: 1, y: 2 }).plan().toJSON(), {
      match: { x: 1, y: 2 },
      rule: {
        match: { x: $.a, y: $.b },
        when: [
          {
            match: { of: $.a, with: $.b, is: $.result },
            operator: 'text/concat',
          },
        ],
      },
    })

    assert.throws(
      () => rule.apply({ x: 1, y: $.unbound }).plan(),
      /Unbound \?b variable referenced/
    )

    assert.throws(
      () => rule.apply({ y: 1, x: $.unbound }).plan(),
      /Unbound \?a variable referenced/
    )
  },

  'handles unified variables in rule case': async (assert) => {
    const Same = Analyzer.rule({
      match: { this: $, as: $ },
    })

    const same = Same.apply({ this: $.x, as: $.y })

    assert.throws(() => same.plan(), /Rule application omits required binding/)
  },

  'unification + input': async (assert) => {
    const rule = Analyzer.rule({
      match: { a: $.a, b: $.a, c: $.c }, // Same variable $.a in both positions
      when: [{ match: { of: $.a, is: $.c }, operator: '==' }],
    })

    assert.ok(
      rule.apply({ a: 1, b: 1, c: $.unbound }).plan().cost >=
        rule.apply({ a: 1, b: 1, c: 1 }).plan().cost,
      'output cell can be omitted'
    )
  },
  'errors if rule branch references undefined variable': async (assert) => {
    const rule = Analyzer.rule({
      match: { x: $.x, y: $.y },
      when: [
        {
          match: { of: $.z, with: $.y, is: $.x }, // $.z not in case
          operator: '+',
        },
      ],
    })

    const match = rule.apply({ x: $.a, y: $.b })

    assert.throws(
      () => rule.apply({ x: 'a', y: 'b' }).plan(),
      /Unbound \?z variable referenced from/
    )
  },
  'errors if deductive branch does not handle case variable': async (
    assert
  ) => {
    assert.throws(
      () =>
        Analyzer.plan({
          match: { x: 'x', y: $.out },
          rule: {
            match: { x: $.x, y: $.y },
            when: [
              { match: { the: 'type', of: $.x, is: 'person' } }, // Doesn't handle $.y
            ],
          },
        }),
      /Rule case "when" does not bind variable \?y that rule matches as "y"/
    )
  },
  'inductive rule must repeat all the match terms': async (assert) => {
    assert.throws(
      () =>
        Analyzer.loop({
          match: { head: $.head, tail: $.tail },
          when: [{ match: { the: 'next', of: $.head, is: $.tail } }],
          // @ts-expect-error - tail is missing
          repeat: { head: $.head },
          while: [{ match: { the: 'next', of: $.head, is: $.tail } }],
        }),
      /Rule has inconsistent bindings across repeat: { head: \$.head } and match: { head: \$.head, tail: \$.tail }\n  - "tail" is missing in repeat/
    )
  },
  'throws on unknown references': async (assert) => {
    assert.throws(
      () =>
        Analyzer.loop({
          match: { head: $.head, tail: $.tail },
          when: [{ match: { the: 'next', of: $.head, is: $.tail } }],
          repeat: { head: $.next, tail: $.tail },
          while: [{ match: { the: 'next', of: $.head, is: $.tail } }],
        }),
      /Rule case "while" does not bind variable \?next that rule matches as "head"/
    )
  },
  'recursive rule must must have base case': (assert) => {
    assert.throws(
      () =>
        // @ts-expect-error
        Analyzer.loop({
          match: { x: $.x },
          repeat: { x: $.inc },
          while: [
            {
              match: { of: $.x, with: 1, is: $.inc },
              operator: '+',
            },
          ],
        }),
      /Inductive rule must have "when" property/
    )
  },
  'inductive rule needs a non empty when': async (assert) => {
    assert.throws(
      () =>
        Analyzer.loop({
          match: { this: $.from, from: $.from, to: $.to },
          // @ts-expect-error - missing when
          when: [],
          repeat: { this: $.inc, from: $.from, to: $.to },
          while: [
            { match: { of: $.from, with: 1, is: $.inc }, operator: '+' },
            { match: { this: $.inc, than: $.to }, operator: '<' },
          ],
        }),
      /Inductive rule must have "when" property establishing base case of recursion/
    )
  },
  'recursive rule must have when that binds all variables': async (assert) => {
    assert.throws(
      () =>
        Analyzer.loop({
          match: { this: $.value, from: $.from, to: $.to },
          when: [{ match: { this: $.from, than: $.to }, operator: '<' }],
          repeat: { this: $.inc, from: $.from, to: $.to },
          while: [
            { match: { of: $.from, with: 1, is: $.inc }, operator: '+' },
            { match: { this: $.inc, than: $.to }, operator: '<' },
          ],
        }),
      /Rule case "when" does not bind variable \?value that rule matches as "this"/
    )
  },
  'allows output variables to be omitted from match': async (assert) => {
    const plan = Analyzer.plan({
      // @ts-expect-error
      match: { x: 'test' },
      rule: {
        match: { x: $.x, y: $.y },
        when: [{ match: { of: $.x, is: $.y }, operator: 'math/absolute' }],
      },
    })

    assert.ok(plan, 'Should allow omitting output variables')
  },
  'detects unresolvable cycles between branches': async (assert) => {
    assert.throws(() => {
      Analyzer.plan({
        match: { x: $.x, y: $.y },
        rule: {
          match: { x: $.x, y: $.y },
          when: [
            { match: { of: $.y, is: $.x }, operator: 'math/absolute' },
            { match: { of: $.x, with: 1, is: $.y }, operator: '+' },
          ],
        },
      })
    }, /circular dependency/)
  },
  'detects cycles even with initial output': async (assert) => {
    assert.throws(
      () =>
        Analyzer.plan({
          match: { x: $.x, y: $.y },
          rule: {
            match: { x: $.x, y: $.y },
            when: [
              { match: { the: 'type', of: $.x, is: 'person' } }, // Outputs $.x
              { match: { of: $.x, with: 1, is: $.y }, operator: '+' }, // Uses $.x to produce $.y
              { match: { of: $.y, by: 1, is: $.x }, operator: '-' }, // Creates cycle by producing $.x again
            ],
          },
        }),
      /Unresolvable circular dependency/
    )
  },

  'cycle in formula': async (assert) => {
    assert.throws(() => {
      Analyzer.plan({
        match: { x: $.x },
        rule: {
          match: { x: $.x },
          when: [
            {
              match: { of: $.x, with: 1, is: $.x },
              operator: '+',
            },
          ],
        },
      })
    }, /Variable .* cannot appear in both input and output of Match clause/)
  },

  'cycles between disjunctive branches are valid': async (assert) => {
    const plan = Analyzer.plan({
      match: { x: 'x', y: 'y' },
      rule: {
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
      },
    })

    assert.ok(plan, 'Rule should plan successfully')
  },

  'plans rule based on available bindings': async (assert) => {
    const plan = Analyzer.plan({
      match: { x: $.x },
      rule: {
        match: { x: $.x },
        when: [
          { match: { the: 'type', of: $.x, is: 'person' } },
          { match: { the: 'name', of: $.x, is: $.name } },
        ],
      },
    })

    assert.ok(plan, 'Should plan successfully')
  },

  'fails to plan when required inputs missing': async (assert) => {
    assert.throws(
      () =>
        Analyzer.plan({
          match: { x: $.x },
          rule: {
            match: { x: $.x },
            when: [
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
        }),
      /Unbound \?y variable referenced from { match: { of: \$.y, with: 1, is: \$.x }, operator: "\+" }/
    )
  },

  'plans rule when inputs are bound': async (assert) => {
    const rule = Analyzer.rule({
      match: { x: $.x, y: $.y },
      when: [
        // Needs $.x to produce $.y
        { match: { of: $.x, with: 1, is: $.y }, operator: '+' },
      ],
    })

    const match = rule.apply({ x: $.in, y: $.out })

    assert.ok(
      rule.apply({ x: 'in', y: 'out' }).plan(),
      'Plans when input is bound'
    )
    assert.throws(
      () => rule.apply({ x: $.x, y: 'out' }).plan(),
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
    const Inductive = ({ from, to }) =>
      Analyzer.plan({
        match: { n: $.n, from, to },
        rule: {
          match: { n: $.n, from: $.from, to: $.to },
          when: [
            { match: { this: $.from, than: $.to }, operator: '<' },
            { match: { of: $.from, is: $.n }, operator: '==' },
          ],
          repeat: { n: $.n, from: $.inc, to: $.to },
          while: [{ match: { of: $.from, with: 1, is: $.inc }, operator: '+' }],
        },
      })

    /**
     * @param {object} source
     * @param {API.Term} source.from
     * @param {API.Term} source.to
     * @returns
     */
    const Deductive = ({ from, to }) =>
      Analyzer.plan({
        match: { n: $.n, from, to },
        rule: {
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
        },
      })

    assert.ok(
      Inductive({ from: 0, to: 10 }).cost > Deductive({ from: 0, to: 10 }).cost,
      'Inductive rule should have higher cost'
    )
  },

  'considers variable mapping in cost estimation': async (assert) => {
    const rule = Analyzer.rule({
      match: { x: $.x },
      when: [{ match: { of: $.x, with: 1, is: $.y }, operator: '+' }],
    })

    assert.ok(rule.apply({ x: 1 }).plan(), 'Should plan with mapped variables')
    assert.ok(
      rule.apply({ x: 'thing' }).plan(),
      'Should plan with bound variables'
    )
  },

  'plans rule with no body': async (assert) => {
    const Same = Analyzer.rule({
      match: { this: $, as: $ },
    })

    const plan = Same.apply({ this: $.x, as: $.x }).plan({
      frame: new Map([[$.x, 1]]),
      references: new Map(),
    })

    assert.ok(
      plan.cost < 1,
      'Empty rule should have very low cost as it just unifies variables'
    )

    assert.throws(
      () => Same.apply({ this: $.x, as: $.x }).plan(),
      /Rule application omits required binding/
    )
  },
  'compares iteration rule cost to against scan cost': async (assert) => {
    const Between = Analyzer.loop({
      match: { value: $.value, from: $.from, to: $.to },
      when: [
        { match: { this: $.from, than: $.to }, operator: '<' },
        { match: { of: $.from, is: $.value }, operator: '==' },
      ],
      repeat: { value: $.value, from: $.next, to: $.to },
      while: [{ match: { of: $.from, with: 1, is: $.next }, operator: '+' }],
    })

    const Scan = Analyzer.rule({
      match: { x: $.x },
      when: [{ match: { the: 'type', of: $.x, is: 'document' } }],
    })

    const between = Between.apply({ from: 0, to: 100, value: $.n }).plan()

    const scan = Scan.apply({ x: $.x }).plan()

    assert.ok(
      between.cost < scan.cost,
      'Between rule using only formula operations should be cheaper than a full scan'
    )
  },

  'estimates costs correctly for Case patterns': async (assert) => {
    // Helper to create a test case

    const select = Analyzer.rule({
      match: { the: $.attribute, of: $.entity, is: $.value },
      when: [{ match: { the: $.attribute, of: $.entity, is: $.value } }],
    })

    /**
     * @param {Omit<Required<API.Select>, 'this'>} terms
     * @param {Partial<Analyzer.Context>} context
     */
    const testCost = (
      terms,
      { frame = new Map(), references = new Map() } = {}
    ) =>
      select.apply(terms).plan({
        frame,
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
            frame: new Map([[$.entity, entityId]]),
          }
        ),
      'Known entity should cost same as bound entity variable'
    )

    assert.ok(
      testCost({ the: 'type', of: $.entity, is: entityId }) ==
        testCost(
          { the: 'type', of: $.entity, is: $.value },
          {
            frame: new Map([[$.value, 2]]),
          }
        ),
      'Known value should cost same as bound value variable'
    )
  },

  'test select circuit': (assert) => {
    const plan = Analyzer.plan({
      match: { x: $.x },
      rule: {
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
      },
    })

    console.log('\n', Analyzer.debug(plan.plan))
  },

  'test correctly merges cost estimates': (assert) => {
    const rule = Analyzer.rule({
      match: { of: $.of },
      when: [
        { match: { the: 'name', of: $.of, is: $.name } },
        { match: { of: $.name, is: 'string' }, operator: 'data/type' },
      ],
    })

    const application = rule.apply({ of: $.subject })

    assert.ok(application.cost < Infinity)
  },
}
