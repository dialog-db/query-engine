import * as Syntax from '../src/analyzer.js'
import { Task, Link, $, Var, API } from 'datalogia'

/**
 * @type {import('entail').Suite}
 */
export const testSyntax = {
  'select syntax': async (assert) => {
    const select = Syntax.rule({
      match: { out: $.name },
      when: [Syntax.select({ the: 'person/name', is: $.name })],
    })

    assert.deepEqual(select.form(), {
      where: [
        {
          match: {
            the: 'person/name',
            is: {
              the: $.name,
              as: { port: 'out', distance: 0 },
            },
          },
          fact: {},
        },
      ],
    })
  },

  'select indirect': async (assert) => {
    const select = Syntax.rule({
      match: { this: $.person },
      when: [
        Syntax.select({ the: 'person/name', of: $.person, is: $.name }),
        Syntax.select({ the: 'person/age', of: $.person, is: $.age }),
      ],
    })

    assert.deepEqual(select.form(), {
      where: [
        {
          match: {
            the: 'person/name',
            of: {
              the: $.person,
              as: {
                port: 'this',
                distance: 0,
              },
            },
            is: {
              the: $.name,
              as: {
                match: {
                  the: 'person/name',
                  of: {
                    port: 'this',
                    distance: 0,
                  },
                  is: Syntax.ROUTE_TARGET,
                },
                fact: {},
                distance: 0,
              },
            },
          },
          fact: {},
        },
        {
          match: {
            the: 'person/age',
            of: {
              the: $.person,
              as: {
                port: 'this',
                distance: 0,
              },
            },
            is: {
              the: $.age,
              as: {
                match: {
                  the: 'person/age',
                  of: {
                    port: 'this',
                    distance: 0,
                  },
                  is: Syntax.ROUTE_TARGET,
                },
                fact: {},
                distance: 0,
              },
            },
          },
          fact: {},
        },
      ],
    })
  },

  'select formula': async (assert) => {
    const rule = Syntax.rule({
      match: { remote: $.port },
      when: [{ match: { of: 'port', is: $.port }, operator: '==' }],
    })

    assert.deepEqual(rule.form(), {
      where: [
        {
          match: {
            of: 'port',
            is: {
              the: $.port,
              as: { port: 'remote', distance: 0 },
            },
          },
          operator: '==',
        },
      ],
    })
  },
}
