import { match } from 'entail/assert'
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
          { Select: [$.child, 'semantic/type', 'child'] },
          { Select: [$.uncle, 'relation/nephew', $.child] },
          { Not: { Select: [$.child, 'legal/guardian', $.uncle] } },
        ],
      },
    })

    assert.deepEqual(plan.toJSON(), {
      Where: {
        match: { child: $.child, uncle: $.uncle },
        rule: {
          match: { child: $.child, uncle: $.uncle },
          when: [
            { Select: [$.child, 'semantic/type', 'child'] },
            { Select: [$.uncle, 'relation/nephew', $.child] },
            { Not: { Select: [$.child, 'legal/guardian', $.uncle] } },
          ],
        },
      },
    })
  },

  'negation considered across scopes': async (assert) => {
    const Allowed = /** @type {const} */ ({
      match: { this: $.x },
      when: {
        draft: [{ Select: [$.x, 'status', 'draft'] }],
        activeOwner: [
          { Select: [$.x, 'owner', $.user] },
          { Not: { Select: [$.user, 'status', 'blocked'] } },
        ],
      },
    })

    const plan = Analyzer.plan({
      match: { x: $.y },
      rule: {
        match: { x: $.x },
        when: [
          { Select: [$.x, 'type', 'doc'] },
          { Where: { match: { this: $.x }, rule: Allowed } },
        ],
      },
    })

    assert.deepEqual(plan.toJSON(), {
      Where: {
        match: { x: $.y },
        rule: {
          match: { x: $.x },
          when: [
            { Select: [$.x, 'type', 'doc'] },
            {
              Where: {
                match: { this: $.x },
                rule: {
                  match: { this: $.x },
                  when: {
                    draft: [{ Select: [$.x, 'status', 'draft'] }],
                    activeOwner: [
                      { Select: [$.x, 'owner', $.user] },
                      { Not: { Select: [$.user, 'status', 'blocked'] } },
                    ],
                  },
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
        draft: [{ Select: [$.x, 'status', 'draft'] }],
        activeOwner: [
          { Select: [$.x, 'owner', $.user] },
          { Not: { Select: [$.user, 'status', 'blocked'] } },
        ],
      },
    })

    const Test = /** @type {const} */ ({
      match: { x: $.x },
      when: [
        { Select: [$.x, 'type', 'doc'] },
        { Where: { match: { this: $.x }, rule: Allowed } },
        { Select: [$.user, 'dept', 'eng'] },
      ],
    })

    const plan = Analyzer.plan({
      match: { x: $.myX },
      rule: Test,
    })

    // assert.deepEqual(branch.input, new Set([]))
    // assert.deepEqual(branch.output, new Set([Var.id($.x), Var.id($.user)]))

    // const plan = Analyzer.plan(branch)
    assert.deepEqual(plan.toJSON(), {
      Where: {
        match: { x: $.myX },
        rule: {
          match: { x: $.x },
          when: [
            { Select: [$.x, 'type', 'doc'] },
            { Select: [$.user, 'dept', 'eng'] },
            {
              Where: {
                match: { this: $.x },
                rule: {
                  match: { this: $.x },
                  when: {
                    draft: [{ Select: [$.x, 'status', 'draft'] }],
                    activeOwner: [
                      { Select: [$.x, 'owner', $.user] },
                      { Not: { Select: [$.user, 'status', 'blocked'] } },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    })
  },

  'plans execution by cost': async (assert) => {
    const plan = Analyzer.plan({
      match: { title: $.title, actor: $.actor },
      rule: {
        match: { title: $.title, actor: $.actor },
        when: [
          { Select: [$.movie, 'movie/title', $.title] },
          { Select: [$.movie, 'movie/cast', $.actor] },
          { Select: [$.actor, 'person/name', 'Arnold Schwarzenegger'] },
        ],
      },
    })

    assert.deepEqual(plan.toJSON(), {
      Where: {
        match: { title: $.title, actor: $.actor },
        rule: {
          match: { title: $.title, actor: $.actor },
          when: [
            { Select: [$.actor, 'person/name', 'Arnold Schwarzenegger'] },
            { Select: [$.movie, 'movie/cast', $.actor] },
            { Select: [$.movie, 'movie/title', $.title] },
          ],
        },
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
            { Select: [$.doc, 'type', 'document'] },
            { Select: [$.doc, 'status', 'published'] },
          ],
          draft: [
            { Select: [$.doc, 'type', 'document'] },
            { Select: [$.doc, 'draft', $.version] },
            { Not: { Select: [$.version, 'approved-by', $.reviewer] } },
            { Select: [$.reviewer, 'role', 'editor'] },
          ],
        },
      },
    })

    assert.deepEqual(
      plan.toJSON(),
      {
        Where: {
          match: { doc: $.doc },
          rule: {
            match: { doc: $.doc },
            when: {
              published: [
                { Select: [$.doc, 'type', 'document'] },
                { Select: [$.doc, 'status', 'published'] },
              ],
              draft: [
                { Select: [$.doc, 'type', 'document'] },
                { Select: [$.doc, 'draft', $.version] },
                { Select: [$.reviewer, 'role', 'editor'] },
                { Not: { Select: [$.version, 'approved-by', $.reviewer] } },
              ],
            },
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
            { Select: [$.x, 'author', $.author1] },
            { Select: [$.author1, 'department', 'eng'] },
          ],
          reviewer: [
            { Select: [$.x, 'reviewer', $.reviewer2] },
            { Select: [$.reviewer2, 'level', 'senior'] },
          ],
        },
      },
    })

    assert.deepEqual(plan.toJSON(), {
      Where: {
        match: { x: $.doc },
        rule: {
          match: { x: $.x },
          when: {
            author: [
              { Select: [$.author1, 'department', 'eng'] },
              { Select: [$.x, 'author', $.author1] },
            ],
            reviewer: [
              { Select: [$.reviewer2, 'level', 'senior'] },
              { Select: [$.x, 'reviewer', $.reviewer2] },
            ],
          },
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
            { Select: [$.doc, 'status', 'draft'] },
            { Not: { Select: [$.doc, 'deleted', true] } },
            { Select: [$.doc, 'author', $.user] },
          ],
          branch2: [
            { Not: { Select: [$.team, 'archived', true] } },
            { Select: [$.doc, 'status', 'draft'] },
            { Not: { Select: [$.doc, 'deleted', true] } },
            { Select: [$.doc, 'team', $.team] },
          ],
        },
      },
    })

    assert.deepEqual(
      plan.toJSON(),
      {
        Where: {
          match: { doc: $.document },
          rule: {
            match: { doc: $.doc },
            when: {
              branch1: [
                { Select: [$.doc, 'status', 'draft'] },
                { Select: [$.doc, 'author', $.user] },
                { Not: { Select: [$.doc, 'deleted', true] } },
              ],
              branch2: [
                { Select: [$.doc, 'status', 'draft'] },
                { Select: [$.doc, 'team', $.team] },
                { Not: { Select: [$.team, 'archived', true] } },
                { Not: { Select: [$.doc, 'deleted', true] } },
              ],
            },
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
          { Select: [$.user, 'role', 'admin'] },
          { Select: [$.x, 'review', $.review] },
          { Select: [$.x, 'type', 'doc'] },
          { Select: [$.x, 'owner', $.user] },
          { Select: [$.x, 'status', 'draft'] },
        ],
      },
    })

    assert.deepEqual(plan.toJSON(), {
      Where: {
        match: { x: $.x, user: $.user },
        rule: {
          match: { x: $.x, user: $.user },
          when: [
            { Select: [$.user, 'role', 'admin'] },
            { Select: [$.x, 'type', 'doc'] },
            { Select: [$.x, 'owner', $.user] },
            { Select: [$.x, 'status', 'draft'] },
            { Select: [$.x, 'review', $.review] },
          ],
        },
      },
    })
  },

  'handles Match clauses with variable dependencies': async (assert) => {
    const plan = Analyzer.plan({
      match: { doc: $.doc, count: $.count, size: $.size },
      rule: {
        match: { doc: $.doc, count: $.count, size: $.size },
        when: [
          { Match: [$.count, 'text/length', $.size] },
          { Match: [$.size, '==', 1000] },
          { Select: [$.doc, 'word-count', $.count] },
        ],
      },
    })

    assert.deepEqual(plan.toJSON(), {
      Where: {
        match: { doc: $.doc, count: $.count, size: $.size },
        rule: {
          match: { doc: $.doc, count: $.count, size: $.size },
          when: [
            { Select: [$.doc, 'word-count', $.count] },
            { Match: [$.count, 'text/length', $.size] },
            { Match: [$.size, '==', 1000] },
          ],
        },
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
            { Select: [$.doc, 'status', 'ready'] },
            { Match: [$.user, '==', 'admin'] },
          ],
        },
      })
    }, /Unbound \?user variable referenced from { Match: \[\?user, "==", "admin"\] }/)
  },

  'terms in match affect planning': async (assert) => {
    const plan = Analyzer.plan({
      match: { user: 1 },
      rule: {
        match: { user: $.user },
        when: {
          author: [
            { Select: [$.doc, 'draft', $.version] },
            { Select: [$.doc, 'author', $.user] },
          ],
          reviewer: [{ Select: [$.doc, 'reviewer', $.user] }],
        },
      },
    })

    assert.deepEqual(plan.toJSON(), {
      Where: {
        match: { user: 1 },
        rule: {
          match: { user: $.user },
          when: {
            author: [
              { Select: [$.doc, 'author', $.user] },
              { Select: [$.doc, 'draft', $.version] },
            ],
            reviewer: [{ Select: [$.doc, 'reviewer', $.user] }],
          },
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
              { Match: [$.count, '==', 100] },
              { Select: [$.doc, 'type', 'counter'] },
            ],
            branch2: [{ Select: [$.doc, 'type', 'doc'] }],
          },
        },
      })
    }, /Unbound \?count variable referenced from { Match: \[\?count, "==", 100\] }/)
  },

  'correctly maps variables across scopes': async (assert) => {
    const plan = Analyzer.plan({
      match: { x: $.y, y: $.x },
      rule: {
        match: { x: $.x, y: $.y },
        when: [
          { Select: [$.y, 'type', 'person'] },
          { Select: [$.y, 'name', $.x] },
        ],
      },
    })

    assert.deepEqual(plan.toJSON(), {
      Where: {
        match: { x: $.y, y: $.x },
        rule: {
          match: { x: $.x, y: $.y },
          when: [
            { Select: [$.y, 'type', 'person'] },
            { Select: [$.y, 'name', $.x] },
          ],
        },
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
            when: [{ Select: [$.y, 'type', 'person'] }],
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
                { Select: [$.y, 'type', 'person'] },
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
            when: [{ Select: [$.x, 'link', $.y] }],
            repeat: { x: $.x, y: $.z },
            while: [{ Select: [$.x, 'link', $.z] }],
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
            while: [{ Match: [[$.x, 1], '+', $.inc] }],
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
            { Match: [$.type, '==', 'type'] },
            { Select: [$.y, $.type, 'person'] },
            { Select: [$.y, 'name', $.x] },
          ],
        },
      })

    assert.deepEqual(
      make($.input).toJSON(),
      {
        Where: {
          match: { x: $.input, y: $.output },
          rule: {
            match: { x: $.x, y: $.y },
            when: [
              { Select: [$.y, $.type, 'person'] },
              { Match: [$.type, '==', 'type'] },
              { Select: [$.y, 'name', $.x] },
            ],
          },
        },
      },
      'without bindings order remains same'
    )

    assert.deepEqual(
      make('John').toJSON(),
      {
        Where: {
          match: { x: 'John', y: $.output },
          rule: {
            match: { x: $.x, y: $.y },
            when: [
              { Select: [$.y, 'name', $.x] },
              { Select: [$.y, $.type, 'person'] },
              { Match: [$.type, '==', 'type'] },
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
      Analyzer.plan({
        match: { person },
        rule: {
          match: { person: $.person },
          when: {
            manager: [{ Select: [$.person, 'role', 'manager'] }],
            senior: [
              { Select: [$.person, 'role', 'employee'] },
              { Select: [$.person, 'level', 'senior'] },
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
            ref: [{ Match: [$.result, 'data/type', 'reference'] }],
            else: [
              { Match: [$.type, '==', 'b'] },
              { Select: [$.x, $.type, 'b'] },
              { Select: [$.x, 'value', $.result] },
            ],
          },
        },
      })

    assert.deepEqual(plan('data').toJSON(), {
      Where: {
        match: { result: 'data' },
        rule: {
          match: { result: $.result },
          when: {
            ref: [{ Match: [$.result, 'data/type', 'reference'] }],
            else: [
              { Select: [$.x, 'value', $.result] },
              { Select: [$.x, $.type, 'b'] },
              { Match: [$.type, '==', 'b'] },
            ],
          },
        },
      },
    })

    assert.throws(
      () => plan($.q),
      /Unbound \?result variable referenced from { Match: \[\?result, "data\/type", "reference"\] }/
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
            when: [{ Match: [[$.x, $.y], '>'] }],
          },
        }),
      /Rule application omits required binding for "y"/
    )
  },

  'rule output may be provided': async (assert) => {
    const rule = Analyzer.rule({
      match: { x: $.x, y: $.y },
      when: [{ Match: [[$.x, 1], '-', $.y] }],
    })

    const application = rule.match({ x: $.outX, y: $.outY })

    assert.throws(() => {
      application.plan()
    }, /Unbound \?x variable referenced from { Match: \[\[\?x, 1\], "-", \?y\] }/)

    assert.ok(application.plan(new Set([$.outX])).toJSON())
    assert.ok(application.plan(new Set([$.outX, $.outY])).toJSON())
  },

  'rule maps multi-variable input terms correctly': async (assert) => {
    const rule = Analyzer.rule({
      match: { x: $.a, y: $.b },
      when: [{ Match: [[$.a, $.b], 'text/concat', $.result] }],
    })

    const match = rule.match({
      x: $.x,
      y: $.y,
    })

    assert.deepEqual(match.plan(new Set([$.x, $.y])).toJSON(), {
      Where: {
        match: { x: $.x, y: $.y },
        rule: {
          match: { x: $.a, y: $.b },
          when: [{ Match: [[$.a, $.b], 'text/concat', $.result] }],
        },
      },
    })

    assert.throws(
      () => match.plan(new Set([$.x])),
      /Unbound \?b variable referenced/
    )

    assert.throws(
      () => match.plan(new Set([$.y])),
      /Unbound \?a variable referenced/
    )
  },

  'handles unified variables in rule case': async (assert) => {
    const Same = Analyzer.rule({
      match: { this: $, as: $ },
    })

    const same = Same.match({ this: $.x, as: $.y })

    assert.throws(() => same.plan(), /Rule application omits required binding/)
  },

  'unification + input': async (assert) => {
    const RequireAB = Analyzer.rule({
      match: { a: $.a, b: $.a, c: $.c }, // Same variable $.a in both positions
      when: [{ Match: [$.a, '==', $.c] }],
    })

    const requireAB = RequireAB.match({ a: $.x, b: $.y, c: $.z })

    assert.ok(
      requireAB.plan(new Set([$.x, $.y])).cost >=
        requireAB.plan(new Set([$.x, $.y, $.z])).cost,
      'output cell can be omitted'
    )
  },
  'errors if rule branch references undefined variable': async (assert) => {
    const rule = Analyzer.rule({
      match: { x: $.x, y: $.y },
      when: [
        { Match: [[$.z, $.y], '+', $.x] }, // $.z not in case
      ],
    })

    const match = rule.match({ x: $.a, y: $.b })

    assert.throws(
      () => match.plan(new Set([$.a, $.b])),
      /Unbound \?z variable referenced from/
    )
  },
  'errors if deductive branch doesnt handle case variable': async (assert) => {
    assert.throws(
      () =>
        Analyzer.plan({
          match: { x: 'x', y: $.out },
          rule: {
            match: { x: $.x, y: $.y },
            when: [
              { Select: [$.x, 'type', 'person'] }, // Doesn't handle $.y
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
          when: [{ Select: [$.head, 'next', $.tail] }],
          // @ts-expect-error - tail is missing
          repeat: { head: $.head },
          while: [{ Select: [$.head, 'next', $.tail] }],
        }),
      /Rule has inconsistent bindings across repeat: {head: \?head} and match: {head: \?head, tail: \?tail}\n  - "tail" is missing in repeat/
    )
  },
  'throws on unknown references': async (assert) => {
    assert.throws(
      () =>
        Analyzer.loop({
          match: { head: $.head, tail: $.tail },
          when: [{ Select: [$.head, 'next', $.tail] }],
          repeat: { head: $.next, tail: $.tail },
          while: [{ Select: [$.head, 'next', $.tail] }],
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
          while: [{ Match: [[$.x, 1], '+', $.inc] }],
        }),
      /Inductive rule must have "when" property/
    )
  },
  'recursive rule needs a non empty when': async (assert) => {
    assert.throws(
      () =>
        Analyzer.loop({
          match: { this: $.from, from: $.from, to: $.to },
          // @ts-expect-error - missing when
          when: [],
          repeat: { this: $.inc, from: $.from, to: $.to },
          while: [
            { Match: [[$.from, 1], '+', $.inc] },
            { Match: [[$.inc, $.to], '<'] },
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
          when: [{ Match: [[$.from, $.to], '<'] }],
          repeat: { this: $.inc, from: $.from, to: $.to },
          while: [
            { Match: [[$.from, 1], '+', $.inc] },
            { Match: [[$.inc, $.to], '<'] },
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
        when: [{ Match: [$.x, 'math/absolute', $.y] }],
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
            { Match: [$.y, 'math/absolute', $.x] },
            { Match: [[$.x, 1], '+', $.y] },
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
              { Select: [$.x, 'type', 'person'] }, // Outputs $.x
              { Match: [[$.x, 1], '+', $.y] }, // Uses $.x to produce $.y
              { Match: [[$.y, 1], '-', $.x] }, // Creates cycle by producing $.x again
            ],
          },
        }),
      /Unresolvable circular dependency/
    )
  },

  'cycle in Match clause': async (assert) => {
    assert.throws(() => {
      Analyzer.plan({
        match: { x: $.x },
        rule: {
          match: { x: $.x },
          when: [{ Match: [[$.x, 1], '+', $.x] }],
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
          branch1: [{ Match: [[$.x, 1], '+', $.y] }],
          branch2: [{ Match: [[$.y, 1], '-', $.x] }],
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
          { Select: [$.x, 'type', 'person'] },
          { Select: [$.x, 'name', $.name] },
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
            when: [{ Match: [[$.y, 1], '+', $.x] }],
          },
        }),
      /Unbound \?y variable referenced from { Match: \[\[\?y, 1\], "\+", \?x\] }/,
      'Should fail when required inputs not bound'
    )
  },

  'plans rule when inputs are bound': async (assert) => {
    const rule = Analyzer.rule({
      match: { x: $.x, y: $.y },
      when: [
        { Match: [[$.x, 1], '+', $.y] }, // Needs $.x to produce $.y
      ],
    })

    const match = rule.match({ x: $.in, y: $.out })

    assert.ok(match.plan(new Set([$.in])), 'Plans when input is bound')
    assert.throws(
      () => match.plan(),
      /Unbound \?x variable referenced from { Match: \[\[\?x, 1\], "\+", \?y\] }/
    )
  },

  'inflates rule cost based on recursion': async (assert) => {
    /**
     * @param {object} source
     * @param {API.Term} source.from
     * @param {API.Term} source.to
     * @returns
     */
    const Between = ({ from, to }) =>
      Analyzer.plan({
        match: { n: $.n, from, to },
        rule: {
          match: { n: $.n, from: $.from, to: $.to },
          when: [
            { Match: [[$.from, $.to], '<'] },
            { Match: [$.from, '==', $.n] },
          ],
          repeat: { n: $.n, from: $.inc, to: $.to },
          while: [{ Match: [[$.from, 1], '+', $.inc] }],
        },
      })

    /**
     * @param {object} source
     * @param {API.Term} source.from
     * @param {API.Term} source.to
     * @returns
     */
    const NonRecursive = ({ from, to }) =>
      Analyzer.plan({
        match: { n: $.n, from, to },
        rule: {
          match: { n: $.n, from: $.from, to: $.to },
          when: {
            base: [
              { Match: [[$.from, $.to], '<'] },
              { Match: [$.from, '==', $.n] },
            ],
            else: [
              { Match: [[$.from, 1], '+', $.n] },
              { Match: [[$.n, $.to], '<'] },
            ],
          },
        },
      })

    assert.ok(
      Between({ from: 0, to: 10 }).cost >
        NonRecursive({ from: 0, to: 10 }).cost,
      'Recursive rule should have higher cost'
    )
  },

  'considers variable mapping in cost estimation': async (assert) => {
    const rule = Analyzer.rule({
      match: { x: $.x },
      when: [{ Match: [[$.x, 1], '+', $.y] }],
    })

    assert.ok(rule.match({ x: 1 }).plan(), 'Should plan with mapped variables')
    assert.ok(
      rule.match({ x: $.thing }).plan(new Set([$.thing])),
      'Should plan with bound variables'
    )
  },

  'plans rule with no body': async (assert) => {
    const Same = Analyzer.rule({
      match: { this: $, as: $ },
    })

    const same = Same.match({ this: $.x, as: $.x })

    const plan = same.plan(new Set([$.x]))

    assert.ok(
      plan.cost < 1,
      'Empty rule should have very low cost as it just unifies variables'
    )

    assert.throws(() => same.plan(), /Rule application omits required binding/)
  },
  'compares iteration rule cost to against scan cost': async (assert) => {
    const Between = Analyzer.loop({
      match: { value: $.value, from: $.from, to: $.to },
      when: [
        { Match: [[$.from, $.to], '<'] },
        { Match: [$.from, '==', $.value] },
      ],
      repeat: { value: $.value, from: $.next, to: $.to },
      while: [{ Match: [[$.from, 1], '+', $.next] }],
    })

    const Scan = Analyzer.rule({
      match: { x: $.x },
      when: [{ Select: [$.x, 'type', 'document'] }],
    })

    const between = Between.match({ from: 0, to: 100, value: $.n }).plan()

    const scan = Scan.match({ x: $.x }).plan()

    assert.ok(
      between.cost < scan.cost,
      'Between rule using only formula operations should be cheaper than a full scan'
    )
  },

  'estimates costs correctly for Case patterns': async (assert) => {
    // Helper to create a test case

    /**
     * @param {API.Pattern} pattern
     * @param {API.Conclusion} [terms]
     * @param {Set<API.Variable>} bindings
     */
    const testCost = (pattern, terms = {}, bindings = new Set()) =>
      /** @type {number} */ (
        Analyzer.rule({
          match: terms,
          when: [{ Select: pattern }],
        }).plan(bindings).cost
      )

    // Test EAV index cases
    const entityId = Link.of('test-entity')
    assert.ok(
      testCost([entityId, 'type', $.value]) <
        testCost([$.entity, 'type', $.value]),
      'Known entity should be cheaper than unknown'
    )

    // Test attribute selectivity
    assert.ok(
      testCost([$.entity, 'type', $.value]) <
        testCost([$.entity, $.attribute, $.value]),
      'Known attribute should be cheaper than unknown'
    )

    // Test value types
    assert.ok(
      testCost([$.entity, $.attribute, entityId]) ==
        testCost([$.entity, $.attribute, 'some-string']),
      'Entity value should be more selective than string'
    )

    assert.ok(
      testCost([$.entity, $.attribute, 'string']) ==
        testCost([$.entity, $.attribute, true]),
      'String should be more selective than boolean'
    )

    // Test index usage
    assert.ok(
      testCost([entityId, 'type', $.value]) <
        testCost([entityId, $.attribute, $.value]),
      'EAV index should be cheaper than scanning entity'
    )

    assert.ok(
      testCost([$.entity, 'type', entityId]) <
        testCost([$.entity, $.attribute, entityId]),
      'VAE index should be cheaper than scanning value'
    )

    // Test bound variables
    assert.ok(
      testCost([entityId, 'type', $.value]) ==
        testCost(
          [$.entity, 'type', $.value],
          { entity: $.entity, value: $.value },
          new Set([$.entity])
        ),
      'Known entity should cost same as bound entity variable'
    )

    assert.ok(
      testCost([$.entity, 'type', entityId]) ==
        testCost(
          [$.entity, 'type', $.value],
          { entity: $.entity, value: $.value },
          new Set([$.value])
        ),
      'Known value should cost same as bound value variable'
    )
  },
}
