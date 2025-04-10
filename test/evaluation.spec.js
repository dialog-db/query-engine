import * as DB from 'datalogia'
import * as Analyzer from '../src/analyzer.js'
import { Task, Link, $, Var, API } from 'datalogia'

/**
 * @type {import('entail').Suite}
 */
export const testEvaluation = {
  'plans negation last': async (assert) => {
    const db = DB.Memory.create([alice])

    const plan = Analyzer.rule({
      match: {
        manager: $.manager,
        employee: $.employee,
        managerName: $.managerName,
        employeeName: $.employeeName,
      },
      when: {
        where: [
          {
            match: {
              name: $.managerName,
              supervisor: $.manager,
              report: $.employee,
            },
            rule: {
              match: {
                name: $.name,
                supervisor: $.supervisor,
                report: $.report,
              },
              when: {
                where: [
                  {
                    match: {
                      the: 'person/name',
                      of: $.supervisor,
                      is: $.name,
                    },
                  },
                  {
                    match: {
                      the: 'work/report',
                      of: $.supervisor,
                      is: $.report,
                    },
                  },
                ],
              },
            },
          },
          {
            match: {
              person: $.employee,
              name: $.employeeName,
            },
            rule: {
              match: {
                name: $.name,
                person: $.person,
              },
              when: {
                where: [
                  {
                    match: {
                      the: 'person/name',
                      of: $.person,
                      is: $.name,
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    })
      .apply({
        manager: $.$manager,
        employee: $.$employee,
        managerName: $.$managerName,
        employeeName: $.$employeeName,
      })
      .prepare()

    const result = await Task.perform(plan.query({ from: db }))

    assert.deepEqual(result, [
      {
        manager: Link.of(alice),
        employee: Link.of(bob),
        managerName: 'Alice',
        employeeName: 'Bob',
      },
      {
        manager: Link.of(bob),
        employee: Link.of(mallory),
        managerName: 'Bob',
        employeeName: 'Mallory',
      },
    ])
  },

  'same variable as different binding': async (assert) => {
    const db = DB.Memory.create([alice])

    const rule = Analyzer.rule({
      match: {
        a: $.a,
        actual: $.aa,
        b: $.b,
        expect: $.bb,
      },
      when: {
        where: [
          {
            match: {
              the: 'person/name',
              of: $.a,
              is: $.aa,
            },
          },
          {
            match: {
              the: 'person/name',
              of: $.b,
              is: $.bb,
            },
          },
        ],
      },
    })

    const plan = rule
      .apply({
        a: $.subject,
        actual: $.actual,
        b: $.subject,
        expect: $.expect,
      })
      .prepare()

    const result = await Task.perform(plan.query({ from: db }))

    assert.deepEqual(result, [
      {
        a: Link.of(alice),
        actual: 'Alice',
        b: Link.of(alice),
        expect: 'Alice',
      },
      {
        a: Link.of(bob),
        actual: 'Bob',
        b: Link.of(bob),
        expect: 'Bob',
      },
      {
        a: Link.of(mallory),
        actual: 'Mallory',
        b: Link.of(mallory),
        expect: 'Mallory',
      },
    ])
  },

  'test generate query': async (assert) => {
    const mallory = { 'Person/name': 'Mallory' }
    const bob = {
      'Person/name': 'Bob',
      'Manages/employee': mallory,
    }
    const alice = {
      'Person/name': 'Alice',
      'Manages/employee': bob,
    }
    const db = DB.Memory.create([alice])

    const rule = Analyzer.rule({
      match: {
        this: $.this,
        'name.the': $['name.the'],
        'name.is': $['name.is'],
        'name.of': $.this,
        'manages.the': $['manages.the'],
        'manages.is.name.the': $['manages.is.name.the'],
        'manages.is.name.is': $['manages.is.name.is'],
        'manages.of': $.this,
      },
      when: {
        where: [
          {
            match: { the: $['name.the'], is: $['name.is'], of: $.this },
            rule: {
              match: { the: $.the, is: $.is, of: $.of },
              when: {
                where: [
                  { match: { of: 'Person/name', is: $.the }, operator: '==' },
                  { match: { the: $.the, of: $.of, is: $.is } },
                  { match: { of: $.is, is: 'string' }, operator: 'data/type' },
                ],
              },
            },
          },
          {
            match: {
              the: $['manages.the'],
              'is.this': $['manages.is.this'],
              'is.name.the': $['manages.is.name.the'],
              'is.name.is': $['manages.is.name.is'],
              of: $.this,
            },
            rule: {
              match: {
                the: $.the,
                'is.this': $['is.this'],
                'is.name.the': $['is.name.the'],
                'is.name.is': $['is.name.is'],
                of: $.of,
              },
              when: {
                where: [
                  {
                    match: { of: 'Manages/employee', is: $.the },
                    operator: '==',
                  },
                  { match: { the: $.the, of: $.of, is: $['is.this'] } },
                  {
                    match: {
                      this: $['is.this'],
                      'name.the': $['is.name.the'],
                      'name.is': $['is.name.is'],
                      'name.of': $['is.this'],
                    },
                    rule: {
                      match: {
                        this: $.this,
                        'name.the': $['name.the'],
                        'name.is': $['name.is'],
                        'name.of': $.this,
                      },
                      when: {
                        where: [
                          {
                            match: {
                              the: $['name.the'],
                              is: $['name.is'],
                              of: $.this,
                            },
                            rule: {
                              match: { the: $.the, is: $.is, of: $.of },
                              when: [
                                {
                                  match: { of: 'Person/name', is: $.the },
                                  operator: '==',
                                },
                                { match: { the: $.the, of: $.of, is: $.is } },
                                {
                                  match: { of: $.is, is: 'string' },
                                  operator: 'data/type',
                                },
                              ],
                            },
                          },
                        ],
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

    const result = await rule.apply().select({ from: db })

    assert.deepEqual(result, [
      {
        this: Link.of(alice),
        'name.the': 'Person/name',
        'name.is': 'Alice',
        'name.of': Link.of(alice),
        'manages.of': Link.of(alice),
        'manages.the': 'Manages/employee',
        'manages.is.name.the': 'Person/name',
        'manages.is.name.is': 'Bob',
      },
      {
        this: Link.of(bob),
        'name.the': 'Person/name',
        'name.is': 'Bob',
        'name.of': Link.of(bob),
        'manages.of': Link.of(bob),
        'manages.the': 'Manages/employee',
        'manages.is.name.the': 'Person/name',
        'manages.is.name.is': 'Mallory',
      },
    ])
  },
}

const mallory = {
  'person/name': 'Mallory',
}

const bob = {
  'person/name': 'Bob',
  'work/report': mallory,
}

const alice = {
  'person/name': 'Alice',
  'work/report': bob,
}
