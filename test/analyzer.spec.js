import * as Analyzer from '../src/analyzer.js'
import { Task, Link, $, Var } from 'datalogia'

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
      cost: 82,
      And: [
        { cost: 60, Case: [$.child, 'semantic/type', 'child'] },
        { cost: 20, Case: [$.uncle, 'relation/nephew', $.child] },
        {
          cost: 2,
          Not: { cost: 2, Case: [$.child, 'legal/guardian', $.uncle] },
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
      cost: 86,
      And: [
        { cost: 60, Case: [$.x, 'type', 'document'] },
        {
          cost: 26,
          Or: [
            {
              cost: 6,
              Case: [$.x, 'status', 'draft'],
            },
            {
              cost: 26,
              And: [
                {
                  cost: 20,
                  Case: [$.x, 'owner', $.user],
                },
                {
                  cost: 6,
                  Not: {
                    cost: 6,
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

  'require branch consistency for non-locals': async (assert) => {
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
    assert.match(plan.error, /Non local variable/)
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
      cost: 100,
      And: [
        { cost: 60, Case: [$.actor, 'person/name', 'Arnold Schwarzenegger'] },
        { cost: 20, Case: [$.movie, 'movie/cast', $.actor] },
        { cost: 20, Case: [$.movie, 'movie/title', $.title] },
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
      cost: 80,
      Or: [
        { cost: 60, Case: [$.x, 'status', 'draft'] },
        {
          cost: 80,
          And: [
            { cost: 60, Case: [$.user, 'role', 'admin'] },
            { cost: 20, Case: [$.x, 'owner', $.user] },
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
          { Case: [$.doc, 'type', 'document'], cost: 60 },
          {
            Or: [
              { Case: [$.doc, 'status', 'published'], cost: 6 },
              {
                And: [
                  { Case: [$.doc, 'draft', $.version], cost: 20 },
                  { Case: [$.reviewer, 'role', 'editor'], cost: 60 },
                  {
                    Not: {
                      Case: [$.version, 'approved-by', $.reviewer],
                      cost: 2,
                    },
                    cost: 2,
                  },
                ],
                cost: 82,
              },
            ],
            cost: 82,
          },
        ],
        cost: 142,
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
      cost: 80,
      Or: [
        {
          cost: 80,
          And: [
            { cost: 60, Case: [$.author1, 'department', 'eng'] },
            { cost: 20, Case: [$.doc, 'author', $.author1] },
          ],
        },
        {
          cost: 80,
          And: [
            { cost: 60, Case: [$.reviewer2, 'level', 'senior'] },
            { cost: 20, Case: [$.doc, 'reviewer', $.reviewer2] },
          ],
        },
      ],
    })
  },
  'nested Or requires consistency with parent scope': async (assert) => {
    const branch = Analyzer.analyze({
      And: [
        { Case: [$.x, 'type', 'doc'] },
        {
          Or: [
            { Case: [$.x, 'status', 'draft'] },
            {
              Or: [
                { Case: [$.x, 'review', $.review] },
                { Case: [$.x, 'owner', $.user] }, // Inconsistent with sibling Or
              ],
            },
          ],
        },
        { Case: [$.user, 'role', 'admin'] }, // Makes $.user non-local
      ],
    })

    const plan = Analyzer.plan(branch)
    assert.match(plan.error, /Non local variable/)
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
        cost: 92,
        And: [
          {
            cost: 60,
            Case: [$.doc, 'status', 'draft'],
          },
          {
            cost: 26,
            Or: [
              {
                cost: 20,
                Case: [$.doc, 'author', $.user],
              },
              {
                cost: 26,
                And: [
                  {
                    cost: 20,
                    Case: [$.doc, 'team', $.team],
                  },
                  {
                    cost: 6,
                    Not: {
                      cost: 6,
                      Case: [$.team, 'archived', true],
                    },
                  },
                ],
              },
            ],
          },
          {
            cost: 6,
            Not: {
              cost: 6,
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
    assert.ok(!planJson.And.some((step) => step.And))
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
    assert.ok(!planJson.Or.some((step) => step.Or))
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
    assert.equal(planJson.And[0].Case[1], 'word-count')
    assert.deepEqual(planJson.And[1].Match[0], $.count)
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
      cost: 22,
      And: [
        { cost: 0, Is: [$.type, 'document'] },
        { cost: 0, Is: [$.status, $.type] },
        { cost: 20, Case: [$.x, 'type', $.type] },
        { cost: 2, Case: [$.x, 'status', $.status] },
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
      cost: 202,
      And: [
        { cost: 200, Case: [$.x, 'type', $.type] },
        { cost: 0, Is: [$.status, $.type] },
        { cost: 2, Case: [$.x, 'status', $.status] },
      ],
    })
  },

  'skip handles Mix of Match and Is with Or': async (assert) => {
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
        { Case: [$.doc, 'size', $.size], cost: 60 },
        { Match: [$.size, 'text/length', $.length], cost: 0 },
        {
          cost: 0,
          Or: [
            { Is: [$.length, 0], cost: 0 },
            {
              cost: 0,
              And: [
                { Match: [$.length, '==', 100], cost: 0 },
                { Is: [$.size, $.length], cost: 0 },
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
      cost: 60,
      And: [
        { Case: [$.x, 'type', 'doc'], cost: 60 },
        { Is: [$.x, $.y], cost: 0 },
      ],
    })
  },
}
