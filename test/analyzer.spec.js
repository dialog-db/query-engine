import * as Analyzer from '../src/analyzer.js'
import { Task, Link, $, Var, API } from 'datalogia'

/**
 * @type {import('entail').Suite}
 */
export const testAnalyzer = {
  'plans negation last': async (assert) => {
    const and = Analyzer.analyze({
      And: [
        { Case: [$.child, 'semantic/type', 'child'] },
        { Not: { Case: [$.child, 'legal/guardian', $.uncle] } },
        { Case: [$.uncle, 'relation/nephew', $.child] },
      ],
    })

    assert.deepEqual(and.input.size, 0)
    assert.deepEqual(and.output, new Set([Var.id($.child), Var.id($.uncle)]))

    const plan = Analyzer.plan(and)

    assert.deepEqual(plan.toJSON(), {
      And: [
        { Case: [$.child, 'semantic/type', 'child'] },
        { Case: [$.uncle, 'relation/nephew', $.child] },
        {
          Not: { Case: [$.child, 'legal/guardian', $.uncle] },
        },
      ],
    })
  },

  'negation considered across scopes': async (assert) => {
    const branch = Analyzer.analyze({
      And: [
        { Case: [$.x, 'type', 'document'] },
        {
          Or: [
            { Case: [$.x, 'status', 'draft'] },
            {
              And: [
                { Case: [$.x, 'owner', $.user] },
                { Not: { Case: [$.user, 'status', 'blocked'] } },
              ],
            },
          ],
        },
      ],
    })

    assert.deepEqual(branch.output, new Set([Var.id($.x)]))

    const plan = Analyzer.plan(branch)

    assert.deepEqual(plan.toJSON(), {
      And: [
        { Case: [$.x, 'type', 'document'] },
        {
          Or: [
            {
              Case: [$.x, 'status', 'draft'],
            },
            {
              And: [
                {
                  Case: [$.x, 'owner', $.user],
                },
                {
                  Not: {
                    Case: [$.user, 'status', 'blocked'],
                  },
                },
              ],
            },
          ],
        },
      ],
    })
  },

  'variables get bound before used in some disjuncts': async (assert) => {
    const branch = Analyzer.analyze({
      And: [
        { Case: [$.x, 'type', 'doc'] },
        {
          Or: [
            { Case: [$.x, 'status', 'draft'] },
            {
              And: [
                { Case: [$.x, 'owner', $.user] }, // introduces $.user
                { Case: [$.user, 'role', 'admin'] },
              ],
            },
          ],
        },
        { Case: [$.user, 'dept', 'eng'] }, // uses $.user
      ],
    })

    assert.deepEqual(branch.input, new Set([]))
    assert.deepEqual(branch.output, new Set([Var.id($.x), Var.id($.user)]))

    const plan = Analyzer.plan(branch)
    assert.deepEqual(plan.toJSON(), {
      And: [
        { Case: [$.x, 'type', 'doc'] },
        { Case: [$.user, 'dept', 'eng'] },
        {
          Or: [
            { Case: [$.x, 'status', 'draft'] },
            {
              And: [
                { Case: [$.user, 'role', 'admin'] },
                { Case: [$.x, 'owner', $.user] },
              ],
            },
          ],
        },
      ],
    })
  },

  'plans execution by cost': async (assert) => {
    const plan = Analyzer.plan({
      And: [
        { Case: [$.movie, 'movie/title', $.title] },
        { Case: [$.movie, 'movie/cast', $.actor] },
        { Case: [$.actor, 'person/name', 'Arnold Schwarzenegger'] },
      ],
    })

    assert.deepEqual(plan.toJSON(), {
      And: [
        { Case: [$.actor, 'person/name', 'Arnold Schwarzenegger'] },
        { Case: [$.movie, 'movie/cast', $.actor] },
        { Case: [$.movie, 'movie/title', $.title] },
      ],
    })
  },

  'allows local variables in Or branches': async (assert) => {
    const branch = Analyzer.analyze({
      Or: [
        { Case: [$.x, 'status', 'draft'] },
        {
          And: [
            { Case: [$.x, 'owner', $.user] },
            { Case: [$.user, 'role', 'admin'] }, // $.user is local to this branch
          ],
        },
      ],
    })

    assert.deepEqual(branch.input, new Set([]), 'no inputs')
    assert.deepEqual(
      branch.output,
      new Set([Var.id($.x)]),
      'only $.x is output $.user is local'
    )

    const plan = Analyzer.plan(branch)
    assert.deepEqual(plan.toJSON(), {
      Or: [
        { Case: [$.x, 'status', 'draft'] },
        {
          And: [
            { Case: [$.user, 'role', 'admin'] },
            { Case: [$.x, 'owner', $.user] },
          ],
        },
      ],
    })
  },

  'nested Not considers outer scope': async (assert) => {
    const branch = Analyzer.analyze({
      And: [
        { Case: [$.doc, 'type', 'document'] },
        {
          Or: [
            { Case: [$.doc, 'status', 'published'] },
            {
              And: [
                { Case: [$.doc, 'draft', $.version] },
                { Not: { Case: [$.version, 'approved-by', $.reviewer] } },
                { Case: [$.reviewer, 'role', 'editor'] },
              ],
            },
          ],
        },
      ],
    })

    const plan = Analyzer.plan(branch)

    assert.deepEqual(
      plan.toJSON(),
      {
        And: [
          { Case: [$.doc, 'type', 'document'] },
          {
            Or: [
              { Case: [$.doc, 'status', 'published'] },
              {
                And: [
                  { Case: [$.reviewer, 'role', 'editor'] },
                  { Case: [$.doc, 'draft', $.version] },
                  {
                    Not: {
                      Case: [$.version, 'approved-by', $.reviewer],
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      'Verify Not runs after reviewer role is established'
    )
  },

  'handles multiple Or branches with different locals': async (assert) => {
    const branch = Analyzer.analyze({
      Or: [
        {
          And: [
            { Case: [$.doc, 'author', $.author1] },
            { Case: [$.author1, 'department', 'eng'] },
          ],
        },
        {
          And: [
            { Case: [$.doc, 'reviewer', $.reviewer2] },
            { Case: [$.reviewer2, 'level', 'senior'] },
          ],
        },
      ],
    })

    assert.deepEqual(branch.output, new Set([Var.id($.doc)]))
    // author1 and reviewer2 should be local to their respective branches
    const plan = Analyzer.plan(branch)
    assert.deepEqual(plan.toJSON(), {
      Or: [
        {
          And: [
            { Case: [$.author1, 'department', 'eng'] },
            { Case: [$.doc, 'author', $.author1] },
          ],
        },
        {
          And: [
            { Case: [$.reviewer2, 'level', 'senior'] },
            { Case: [$.doc, 'reviewer', $.reviewer2] },
          ],
        },
      ],
    })
  },
  'nested Or requires extension variables to be bound': async (assert) => {
    const branch = Analyzer.analyze({
      And: [
        { Case: [$.x, 'type', 'doc'] },
        {
          Or: [
            { Case: [$.x, 'status', 'draft'] },
            {
              Or: [
                { Case: [$.x, 'review', $.review] }, // $.review local can be unbound
                { Case: [$.x, 'owner', $.user] }, // $.user must be bound prior
              ],
            },
          ],
        },
        { Case: [$.user, 'role', 'admin'] }, // Makes $.user extension variable
      ],
    })

    const plan = Analyzer.plan(branch)
    assert.deepEqual(plan.toJSON(), {
      And: [
        { Case: [$.user, 'role', 'admin'] },
        { Case: [$.x, 'type', 'doc'] },
        {
          Or: [
            { Case: [$.x, 'status', 'draft'] },
            { Case: [$.x, 'review', $.review] },
            { Case: [$.x, 'owner', $.user] },
          ],
        },
      ],
    })
  },

  'handles multiple negations across scopes': async (assert) => {
    const branch = Analyzer.analyze({
      And: [
        { Case: [$.doc, 'status', 'draft'] },
        { Not: { Case: [$.doc, 'deleted', true] } },
        {
          Or: [
            { Case: [$.doc, 'author', $.user] },
            {
              And: [
                { Case: [$.doc, 'team', $.team] },
                { Not: { Case: [$.team, 'archived', true] } },
              ],
            },
          ],
        },
      ],
    })

    const plan = Analyzer.plan(branch)

    assert.deepEqual(
      plan.toJSON(),
      {
        And: [
          {
            Case: [$.doc, 'status', 'draft'],
          },
          {
            Or: [
              {
                Case: [$.doc, 'author', $.user],
              },
              {
                And: [
                  {
                    Case: [$.doc, 'team', $.team],
                  },
                  {
                    Not: {
                      Case: [$.team, 'archived', true],
                    },
                  },
                ],
              },
            ],
          },
          {
            Not: {
              Case: [$.doc, 'deleted', true],
            },
          },
        ],
      },
      'Verify both negations run after their dependencies'
    )
  },
  'flattens nested And clauses': async (assert) => {
    const branch = Analyzer.analyze({
      And: [
        { Case: [$.x, 'type', 'doc'] },
        {
          And: [
            { Case: [$.x, 'status', 'draft'] },
            {
              And: [
                { Case: [$.x, 'owner', $.user] },
                { Case: [$.user, 'role', 'admin'] },
              ],
            },
          ],
        },
      ],
    })

    // Should be flattened into a single And
    assert.deepEqual(branch.output, new Set([Var.id($.x), Var.id($.user)]))
    const plan = Analyzer.plan(branch)

    // Verify no nested Ands in the plan
    const planJson = plan.toJSON()

    // @ts-expect-error
    assert.ok(!planJson.And.some((step) => step.And))
    // @ts-expect-error
    assert.equal(planJson.And.length, 4)
  },

  'flattens nested Or clauses': async (assert) => {
    const branch = Analyzer.analyze({
      Or: [
        { Case: [$.x, 'status', 'draft'] },
        {
          Or: [
            { Case: [$.x, 'status', 'review'] },
            {
              Or: [
                { Case: [$.x, 'status', 'published'] },
                { Case: [$.x, 'status', 'archived'] },
              ],
            },
          ],
        },
      ],
    })

    const plan = Analyzer.plan(branch)
    const planJson = plan.toJSON()

    // Should be flattened into a single Or with 4 cases
    // @ts-expect-error - could have diff shape
    assert.ok(!planJson.Or.some((step) => step.Or))
    // @ts-expect-error - could have diff shape
    assert.equal(planJson.Or.length, 4)
  },

  'handles Match clauses with variable dependencies': async (assert) => {
    const and = Analyzer.analyze({
      And: [
        { Case: [$.doc, 'word-count', $.count] },
        { Match: [$.count, 'text/length', $.size] },
        { Match: [$.size, '==', 1000] },
      ],
    })

    assert.deepEqual(and.input, new Set([]))
    assert.deepEqual(
      and.output,
      new Set([Var.id($.doc), Var.id($.count), Var.id($.size)])
    )
    const plan = Analyzer.plan(and)

    const planJson = plan.toJSON()

    // // Verify execution order respects dependencies
    // @ts-expect-error - could have diff shape
    assert.equal(planJson.And[0].Case[1], 'word-count')
    // @ts-expect-error - could have diff shape
    assert.deepEqual(planJson.And[1].Match[0], $.count)
    // @ts-expect-error - could have diff shape
    assert.deepEqual(planJson.And[2].Match[0], $.size)
  },

  'handles Is clauses with variable bindings': async (assert) => {
    const branch = Analyzer.analyze({
      And: [
        { Case: [$.x, 'type', $.type] },
        { Is: [$.type, 'document'] },
        { Case: [$.x, 'status', $.status] },
        { Is: [$.status, $.type] }, // Requires $.type to be bound
      ],
    })

    const plan = Analyzer.plan(branch)

    assert.deepEqual(plan.toJSON(), {
      And: [
        { Is: [$.type, 'document'] },
        { Is: [$.status, $.type] },
        { Case: [$.x, 'type', $.type] },
        { Case: [$.x, 'status', $.status] },
      ],
    })
  },

  'handles Is clauses that must run after case clause': async (assert) => {
    const branch = Analyzer.analyze({
      And: [
        { Is: [$.status, $.type] }, // Requires $.type to be bound
        { Case: [$.x, 'type', $.type] },
        { Case: [$.x, 'status', $.status] },
      ],
    })

    const plan = Analyzer.plan(branch)

    assert.deepEqual(plan.toJSON(), {
      And: [
        { Case: [$.x, 'type', $.type] },
        { Is: [$.status, $.type] },
        { Case: [$.x, 'status', $.status] },
      ],
    })
  },

  'handles Mix of Match and Is with Or': async (assert) => {
    const branch = Analyzer.analyze({
      And: [
        { Case: [$.doc, 'size', $.size] },
        { Match: [$.size, 'text/length', $.length] },
        {
          Or: [
            { Is: [$.length, 0] },
            {
              And: [
                { Match: [$.length, '==', 100] },
                { Is: [$.size, $.length] },
              ],
            },
          ],
        },
      ],
    })

    const plan = Analyzer.plan(branch)

    assert.deepEqual(plan.toJSON(), {
      And: [
        { Case: [$.doc, 'size', $.size] },
        { Match: [$.size, 'text/length', $.length] },
        {
          Or: [
            { Is: [$.length, 0] },
            {
              And: [
                { Is: [$.size, $.length] },
                { Match: [$.length, '==', 100] },
              ],
            },
          ],
        },
      ],
    })
  },

  'Is clause with two variables requires one bound': async (assert) => {
    const branch = Analyzer.analyze({
      And: [
        { Is: [$.x, $.y] }, // Neither bound - should be unplannable
        { Case: [$.x, 'type', 'doc'] },
      ],
    })

    const plan = Analyzer.plan(branch)

    assert.deepEqual(plan.toJSON(), {
      And: [{ Case: [$.x, 'type', 'doc'] }, { Is: [$.x, $.y] }],
    })
  },

  'handles extensions that are truly local': async (assert) => {
    const branch = Analyzer.analyze({
      Or: [
        { Case: [$.doc, 'status', 'draft'] },
        {
          And: [
            { Case: [$.doc, 'reviewer', $.user] }, // $.user is extension
            { Case: [$.user, 'role', 'admin'] }, // only used in this branch
          ],
        },
      ],
    })

    assert.deepEqual(branch.output, new Set([Var.id($.doc)]))
    const plan = Analyzer.plan(branch)
    assert.ok(!plan.error, 'Should plan successfully when extension is local')
  },

  'requires bound extensions when used in outer scope': async (assert) => {
    const branch = Analyzer.analyze({
      And: [
        { Case: [$.user, 'role', 'admin'] }, // binds $.user first
        {
          Or: [
            { Case: [$.doc, 'status', 'draft'] },
            { Case: [$.doc, 'reviewer', $.user] }, // $.user is extension
          ],
        },
      ],
    })

    const plan = Analyzer.plan(branch)
    assert.deepEqual(plan.toJSON(), {
      And: [
        { Case: [$.user, 'role', 'admin'] },
        {
          Or: [
            { Case: [$.doc, 'status', 'draft'] },
            { Case: [$.doc, 'reviewer', $.user] },
          ],
        },
      ],
    })
  },

  'fails if extension used in outer scope is not bound': async (assert) => {
    const branch = Analyzer.analyze({
      And: [
        {
          Or: [
            { Case: [$.doc, 'status', 'draft'] },
            { Case: [$.doc, 'reviewer', $.user] }, // $.user is extension
          ],
        },
        { Match: [$.user, '==', 'admin'] }, // uses $.user but not bound
      ],
    })

    const plan = Analyzer.plan(branch)
    assert.ok(
      plan.error,
      'Should fail when extension used in outer scope is not bound'
    )
  },

  'handles multiple extensions with mixed binding': async (assert) => {
    const branch = Analyzer.analyze({
      And: [
        { Case: [$.user, 'role', 'admin'] }, // binds $.user
        {
          Or: [
            {
              And: [
                { Case: [$.doc, 'author', $.user] }, // $.user is bound
                { Case: [$.doc, 'draft', $.version] }, // $.version is local extension
              ],
            },
            { Case: [$.doc, 'reviewer', $.user] }, // $.user is bound
          ],
        },
      ],
    })

    const plan = Analyzer.plan(branch)
    assert.ok(
      !plan.error,
      'Should plan successfully with mixed extension binding'
    )
  },

  'fails to plan Is when neither variable can be bound': async (assert) => {
    const branch = Analyzer.analyze({
      Or: [
        { Is: [$.x, $.y] }, // Neither variable can be bound
        { Case: [$.z, 'type', 'doc'] }, // Binds unrelated variable
      ],
    })

    const plan = Analyzer.plan(branch)
    assert.ok(
      plan.error,
      'Should fail when Is clause has no way to get bound variables'
    )
  },

  'fails to plan Match when inputs cannot be bound': async (assert) => {
    const branch = Analyzer.analyze({
      Or: [
        { Match: [$.count, '==', 100] }, // $.count can't be bound in this branch
        { Case: [$.doc, 'type', 'doc'] }, // Binds unrelated variable
      ],
    })

    const plan = Analyzer.plan(branch)
    assert.ok(
      plan.error,
      'Should fail when Match clause inputs cannot be bound'
    )
  },

  'analyzes rule inputs and outputs correctly': async (assert) => {
    const rule = Analyzer.analyze({
      Rule: {
        match: { x: $.output, y: $.input },
        rule: {
          match: { x: $.x, y: $.y },
          when: [
            {
              And: [
                { Case: [$.y, 'type', 'person'] }, // Uses $.y as input
                { Case: [$.y, 'name', $.x] }, // Binds $.x as output
              ],
            },
          ],
        },
      },
    })

    assert.deepEqual([...rule.input], [])
    assert.deepEqual(rule.output, new Set([Var.id($.input), Var.id($.output)]))
  },
  'throws if rule deductive branch does not handle case variable': async (
    assert
  ) => {
    assert.throws(
      () =>
        Analyzer.analyze({
          Rule: {
            match: { x: $.output, y: $.input },
            rule: {
              match: { x: $.x, y: $.y },
              when: {
                base: { Case: [$.y, 'type', 'person'] },
              },
            },
          },
        }),
      /Deductive rule branch "base" does not bind "x" relation/
    )
  },
  'throws if rule inductive branch does not handle case variable': async (
    assert
  ) => {
    assert.throws(
      () =>
        Analyzer.analyze({
          Rule: {
            match: { x: $.output, y: $.input },
            rule: {
              match: { x: $.x, y: $.y },
              when: {
                base: { Case: [$.x, 'link', $.y] },
                induce: {
                  Recur: {
                    match: { x: $.x, y: $.z },
                    where: [{ Case: [$.x, 'link', $.z] }],
                  },
                },
              },
            },
          },
        }),
      /Inductive rule application "induce" does not bind "y" relation/
    )
  },
  'prefers efficient execution path based on bindings': async (assert) => {
    const rule = Analyzer.analyze({
      Rule: {
        match: { x: $.output, y: $.input },
        rule: {
          match: { x: $.x, y: $.y },
          when: [
            {
              And: [
                { Case: [$.y, 'type', 'person'] },
                { Case: [$.y, 'name', $.x] },
              ],
            },
          ],
        },
      },
    })

    assert.equal(rule.input.size, 0)
    assert.deepEqual(rule.output, new Set([Var.id($.input), Var.id($.output)]))

    // With $.input bound
    const boundPlan = Analyzer.plan(rule, {
      bindings: new Set([Var.id($.input)]),
    })

    // Without bindings
    const unboundPlan = Analyzer.plan(rule, {
      bindings: new Set(),
    })

    if (boundPlan.error) {
      return assert.fail(boundPlan.error)
    }

    if (unboundPlan.error) {
      return assert.fail(unboundPlan.error)
    }

    assert.ok(
      boundPlan.cost < unboundPlan.cost,
      'Plan with bound input should have lower cost'
    )
  },

  'estimates costs across complex rule paths': async (assert) => {
    const rule = Analyzer.analyze({
      Rule: {
        match: { employee: $.who },
        rule: {
          match: { employee: $.person },
          when: [
            // Direct path if we know the person
            { Case: [$.person, 'role', 'manager'] },
            // More expensive path requiring multiple lookups
            {
              And: [
                { Case: [$.person, 'role', 'employee'] },
                { Case: [$.person, 'level', 'senior'] },
              ],
            },
          ],
        },
      },
    })

    assert.equal(rule.input.size, 0)
    assert.deepEqual(rule.output, new Set([Var.id($.who)]))

    const boundPlan = Analyzer.plan(rule, {
      bindings: new Set([Var.id($.who)]),
    })
    const unboundPlan = Analyzer.plan(rule, {
      bindings: new Set(),
    })

    if (boundPlan.error) {
      return assert.fail(boundPlan.error)
    }

    if (unboundPlan.error) {
      return assert.fail(unboundPlan.error)
    }

    assert.ok(
      boundPlan.cost < unboundPlan.cost,
      'Plan with bound employee should be cheaper'
    )
  },
  'ensures rule scope is independent from outer scope': async (assert) => {
    const rule = Analyzer.analyze({
      Rule: {
        match: { result: $.q },
        rule: {
          match: { result: $.result },
          when: [
            { Match: [$.result, 'data/type', 'reference'] },
            {
              And: [
                { Case: [$.x, 'type', 'b'] },
                { Case: [$.x, 'value', $.result] },
              ],
            },
          ],
        },
      },
    })

    assert.deepEqual(rule.input, new Set([Var.id($.q)]))
    assert.deepEqual(rule.output, new Set([]))

    // Plan with outer scope having $.result bound
    const plan = Analyzer.plan(rule, {
      bindings: new Set([Var.id($.q)]),
    })

    assert.ok(!plan.error, 'Should plan successfully with independent scope')

    const unplannable = Analyzer.plan(rule)
    assert.ok(unplannable.error, 'Should fail when match variable is not bound')
  },

  'handles rule variable mappings correctly': async (assert) => {
    assert.throws(
      () =>
        Analyzer.analyze({
          Rule: {
            match: {
              x: $.input,
            }, // Missing mapping for input variable
            rule: {
              match: { x: $.x, y: $.y },
              when: [{ Match: [[$.x, $.y], '>'] }],
            },
          },
        }),
      /Rule application omits input binding for "y" relation/
    )
  },

  'rule output may be omitted': async (assert) => {
    const rule = Analyzer.analyze({
      Rule: {
        match: {
          x: $.input,
        },
        rule: {
          match: { x: $.x, y: $.y },
          when: [{ Match: [[$.x, 1], '-', $.y] }],
        },
      },
    })

    assert.deepEqual(rule.input, new Set([Var.id($.input)]))
    assert.deepEqual(rule.output, new Set([]), 'has no output')
  },

  'rule output may be provided': async (assert) => {
    const rule = Analyzer.analyze({
      Rule: {
        match: {
          x: $.outX,
          y: $.outY,
        },
        rule: {
          match: { x: $.x, y: $.y },
          when: [{ Match: [[$.x, 1], '-', $.y] }],
        },
      },
    })

    assert.deepEqual(rule.input, new Set([Var.id($.outX)]))
    assert.deepEqual(rule.output, new Set([Var.id($.outY)]))
  },

  'constants in rule input': async (assert) => {
    const rule = Analyzer.analyze({
      Rule: {
        match: {
          x: 5,
          y: $.outY,
        },
        rule: {
          match: { x: $.x, y: $.y },
          when: [{ Match: [[$.x, 2], '*', $.y] }],
        },
      },
    })

    assert.deepEqual(rule.input, new Set([]))
    assert.deepEqual(rule.output, new Set([Var.id($.outY)]))
  },

  'constants in rule output': async (assert) => {
    const rule = Analyzer.analyze({
      Rule: {
        match: {
          x: $.input,
          y: 5,
        },
        rule: {
          match: { x: $.x, y: $.y },
          when: [{ Match: [[$.x, 0], '>', $.y] }],
        },
      },
    })

    assert.deepEqual(rule.input, new Set([Var.id($.input)]))
    assert.deepEqual(rule.output, new Set([]))
  },

  'rule maps multi-variable input terms correctly': async (assert) => {
    const rule = Analyzer.analyze({
      Rule: {
        match: {
          x: $.x,
          y: $.y,
        },
        rule: {
          match: { x: $.a, y: $.b },
          when: [{ Match: [[$.a, $.b], 'text/concat', $.result] }],
        },
      },
    })

    assert.deepEqual(rule.input, new Set([Var.id($.x), Var.id($.y)]))
  },

  'maps variables through Or clauses correctly': async (assert) => {
    const rule = Analyzer.analyze({
      Rule: {
        match: { x: $.input, result: $.output },
        rule: {
          match: { x: $.x, result: $.r },
          when: [
            {
              Or: [
                { Match: [$.x, 'text/case/upper', $.r] },
                { Match: [$.x, 'text/case/lower', $.r] },
              ],
            },
          ],
        },
      },
    })

    assert.deepEqual(rule.input, new Set([Var.id($.input)]))
    assert.deepEqual(rule.output, new Set([Var.id($.output)]))
  },

  'handles unified variables in rule case': async (assert) => {
    const rule = Analyzer.analyze({
      Rule: {
        match: {
          a: $.x,
          b: $.y,
        },
        rule: {
          match: { a: $.a, b: $.a }, // Same variable $.a in both positions
        },
      },
    })

    assert.deepEqual(rule.input, new Set([Var.id($.x), Var.id($.y)]))
    assert.deepEqual(rule.output, new Set([]))
  },

  'unification + input': async (assert) => {
    const rule = Analyzer.analyze({
      Rule: {
        match: {
          a: $.x,
          b: $.y,
          c: $.z,
        },
        rule: {
          match: { a: $.a, b: $.a, c: $.c }, // Same variable $.a in both positions
          when: [{ Match: [$.a, '==', $.c] }],
        },
      },
    })

    assert.deepEqual(rule.input, new Set([Var.id($.x), Var.id($.y)]))

    assert.deepEqual(rule.output, new Set([Var.id($.z)]))
  },
  'errors if rule branch references undefined variable': async (assert) => {
    assert.throws(
      () =>
        Analyzer.analyze({
          Rule: {
            match: { x: $.x, y: $.y },
            rule: {
              match: { x: $.x, y: $.y },
              when: [
                { Match: [[$.z, $.y], '+', $.x] }, // $.z not in case
              ],
            },
          },
        }),
      /Unbound .* variable referenced/
    )
  },
  'errors if deductive branch doesnt handle case variable': async (assert) => {
    assert.throws(
      () =>
        Analyzer.analyze({
          Rule: {
            match: { x: $.x, y: $.y },
            rule: {
              match: { x: $.x, y: $.y },
              when: [
                { Case: [$.x, 'type', 'person'] }, // Doesn't handle $.y
              ],
            },
          },
        }),
      /Deductive rule branch .* does not bind "y" relation/
    )
  },
  'errors if recursive branch doesnt handle case variable': async (assert) => {
    assert.throws(
      () =>
        Analyzer.analyze({
          Rule: {
            match: { x: $.x, y: $.y },
            rule: {
              match: { x: $.x, y: $.y },
              when: {
                recursive: {
                  Recur: {
                    match: { x: $.x }, // y missing
                    where: [{ Case: [$.x, 'next', $.x] }],
                  },
                },
              },
            },
          },
        }),
      /does not bind "y" relation/
    )
  },
  'errors on unbound recursive application': async (assert) => {
    assert.throws(
      () =>
        Analyzer.analyze({
          Rule: {
            match: { x: $.x, y: $.y },
            rule: {
              match: { x: $.x, y: $.y },
              when: {
                recursive: {
                  Recur: {
                    match: { x: $.z, y: $.y }, // $.z unbound
                    where: [{ Match: [[$.x, $.z], '+', $.xz] }],
                  },
                },
              },
            },
          },
        }),
      /recursively applies .* with an unbound/
    )
  },
  'rule must may not have only inductive branches': (assert) => {
    assert.throws(
      () =>
        Analyzer.analyze({
          Rule: {
            match: { x: $.myX },
            rule: {
              match: { x: $.x },
              when: {
                recursive: {
                  Recur: {
                    match: { x: $.inc },
                    where: [{ Match: [[$.x, 1], '+', $.inc] }],
                  },
                },
              },
            },
          },
        }),
      /Rule may not have just inductive branches/
    )
  },
  'allows output variables to be omitted from match': async (assert) => {
    const rule = Analyzer.analyze({
      Rule: {
        match: { x: $.input }, // y omitted
        rule: {
          match: { x: $.x, y: $.y },
          when: [
            { Match: [$.x, 'math/absolute', $.y] }, // $.y is output
          ],
        },
      },
    })

    assert.deepEqual([...rule.input], [Var.id($.input)])
    assert.deepEqual([...rule.output], [])
  },
  'detects unresolvable cycles between branches': async (assert) => {
    assert.throws(() => {
      const rule = Analyzer.analyze({
        Rule: {
          match: { x: $.x, y: $.y },
          rule: {
            match: { x: $.x, y: $.y },
            when: [
              {
                And: [
                  { Match: [$.y, 'math/absolute', $.x] },
                  { Match: [[$.x, 1], '+', $.y] },
                ],
              },
            ],
          },
        },
      })
    }, /circular dependency/)
  },
  'errors on cycles even with initial output': async (assert) => {
    assert.throws(
      () =>
        Analyzer.analyze({
          Rule: {
            match: { x: $.x, y: $.y },
            rule: {
              match: { x: $.x, y: $.y },
              when: [
                {
                  And: [
                    { Case: [$.x, 'type', 'person'] }, // Outputs $.x
                    { Match: [[$.x, 1], '+', $.y] }, // Uses $.x to produce $.y
                    { Match: [[$.y, 1], '-', $.x] }, // Creates cycle by producing $.x again
                  ],
                },
              ],
            },
          },
        }),
      /Unresolvable circular dependency/
    )
  },

  'cycle in the match clause': async (assert) => {
    assert.throws(() => {
      Analyzer.analyze({
        Match: [[$.x, 1], '+', $.x],
      })
    }, /Variable .* cannot appear in both input and output of Match clause/)
  },

  'cycles between disjunctive branches are fine': async (assert) => {
    const rule = Analyzer.analyze({
      Rule: {
        match: { x: $.x, y: $.y },
        rule: {
          match: { x: $.x, y: $.y },
          when: {
            branch1: { Match: [[$.x, 1], '+', $.y] }, // One way to satisfy rule
            branch2: { Match: [[$.y, 1], '-', $.x] }, // Alternative way
          },
        },
      },
    })

    assert.ok(rule, 'Rule should analyze successfully')
  },

  'plans rule when inputs are bound': async (assert) => {
    const rule = Analyzer.analyze({
      Rule: {
        match: { x: $.x, y: $.y },
        rule: {
          match: { x: $.x, y: $.y },
          when: [
            { Match: [[$.x, 1], '+', $.y] }, // Needs $.x to produce $.y
          ],
        },
      },
    })

    const plan = Analyzer.plan(rule, {
      bindings: new Set([Var.id($.x)]), // $.x bound
    })

    assert.ok(!plan.error, 'Should plan successfully when inputs are bound')
  },
  'fails to plan rule when inputs missing': async (assert) => {
    const rule = Analyzer.analyze({
      Rule: {
        match: { x: $.x, y: $.y },
        rule: {
          match: { x: $.x, y: $.y },
          when: [
            { Match: [[$.x, 1], '+', $.y] }, // Needs $.x to produce $.y
          ],
        },
      },
    })

    const plan = Analyzer.plan(rule, {
      bindings: new Set(), // No bindings
    })

    assert.ok(plan.error, 'Should fail when required inputs not bound')
  },

  'inflates rule cost based on recursion': async (assert) => {
    const recursive = Analyzer.analyze({
      Rule: {
        match: { x: $.x, y: $.y },
        rule: {
          match: { x: $.x, y: $.y },
          when: [
            { Match: [[$.x, 1], '+', $.y] },
            {
              Recur: {
                match: { x: $.next, y: $.y },
                where: [{ Match: [[$.x, 1], '+', $.next] }],
              },
            },
          ],
        },
      },
    })

    const nonRecursive = Analyzer.analyze({
      Rule: {
        match: { x: $.x, y: $.y },
        rule: {
          match: { x: $.x, y: $.y },
          when: [{ Match: [[$.x, 1], '+', $.y] }],
        },
      },
    })

    const recursivePlan = Analyzer.plan(recursive, {
      bindings: new Set([Var.id($.x)]),
    })
    const simplePlan = Analyzer.plan(nonRecursive, {
      bindings: new Set([Var.id($.x)]),
    })

    if (recursivePlan.error) {
      return assert.fail(recursivePlan.error)
    }

    if (simplePlan.error) {
      return assert.fail(simplePlan.error)
    }

    assert.ok(
      recursivePlan.cost > simplePlan.cost,
      'Recursive rule should have higher cost'
    )
  },
  'considers mapping in cost calculation': async (assert) => {
    const rule = Analyzer.analyze({
      Rule: {
        match: { x: $.input, y: $.output }, // Different variable names in match
        rule: {
          match: { x: $.x, y: $.y },
          when: [{ Match: [[$.x, 1], '+', $.y] }],
        },
      },
    })

    const plan = Analyzer.plan(rule, {
      bindings: new Set([Var.id($.input)]), // Bound in outer scope
    })

    assert.ok(!plan.error, 'Should plan with mapped variables')
  },

  'plans rule with no body': async (assert) => {
    const rule = Analyzer.analyze({
      Rule: {
        match: { as: $.x },
        rule: {
          match: { this: $, as: $ }, // No when clause - just unifies variables
        },
      },
    })

    const plan = Analyzer.plan(rule, {
      bindings: new Set([Var.id($.x)]),
    })

    assert.ok(
      (plan.cost ?? Infinity) < 1,
      'Empty rule should have very low cost as it just unifies variables'
    )
  },
  'compares Between rule cost to scan': async (assert) => {
    const between = Analyzer.analyze({
      Rule: {
        match: { value: $.value, from: $.from, to: $.to },
        rule: {
          match: { value: $.value, from: $.from, to: $.to },
          when: {
            deduce: {
              And: [
                { Match: [[$.from, $.to], '<'] },
                { Match: [$.from, '==', $.value] },
              ],
            },
            induce: {
              Recur: {
                match: { from: $.next, to: $.to, value: $.value },
                where: [
                  { Match: [[$.from, 1], '+', $.next] },
                  { Match: [[$.next, $.to], '<'] },
                ],
              },
            },
          },
        },
      },
    })

    const scan = Analyzer.analyze({
      Case: [$.entity, 'type', 'document'],
    })

    const betweenPlan = Analyzer.plan(between, {
      bindings: new Set([Var.id($.from), Var.id($.to)]),
    })

    const scanPlan = Analyzer.plan(scan)

    assert.ok(!betweenPlan.error, 'Between rule should plan successfully')

    if (scanPlan.error) {
      return assert.fail(scanPlan.error)
    }
    if (betweenPlan.error) {
      return assert.fail(betweenPlan.error)
    }

    assert.ok(
      betweenPlan.cost < scanPlan.cost,
      'Between rule using only formula operations should be cheaper than a full scan'
    )
  },

  'estimates costs correctly for Case patterns': async (assert) => {
    // Helper to create a test case
    /**
     *
     * @param {API.Pattern} pattern
     * @param {*} bindings
     */
    const testCost = (pattern, bindings = new Set()) =>
      /** @type {number} */ (
        Analyzer.plan({ Case: pattern }, { bindings }).cost
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
      testCost([$.entity, $.attribute, entityId]) <
        testCost([$.entity, $.attribute, 'some-string']),
      'Entity value should be more selective than string'
    )

    assert.ok(
      testCost([$.entity, $.attribute, 'string']) <
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
    const boundEntity = new Set([Var.id($.entity)])
    assert.ok(
      testCost([entityId, 'type', $.value]) ==
        testCost([$.entity, 'type', $.value], boundEntity),
      'Known entity should cost same as bound entity variable'
    )

    const boundValue = new Set([Var.id($.value)])
    assert.ok(
      testCost([$.entity, 'type', entityId]) <
        testCost([$.entity, 'type', $.value], boundValue),
      'Known entity value should be cheaper than bound value variable'
    )
  },
}
