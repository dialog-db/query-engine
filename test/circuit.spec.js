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
      when: [
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

    const [name, age] = select.disjuncts.when.assertion
    console.log(name.address($.name))
    console.log(age.address($.age))
    console.log(JSON.stringify(select.form(), null, 2))
    return console.log(JSON.stringify(name.form(), null, 2))

    return

    assert.deepEqual(select.form(), {
      when: [
        {
          match: {
            the: 'person/name',
            is: {
              the: $.name,
              as: ['port'],
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
      when: [
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
