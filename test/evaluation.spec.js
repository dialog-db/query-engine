import * as DB from 'datalogia'
import * as Analyzer from '../src/analyzer.js'
import { Task, Link, $, Var, API } from 'datalogia'

/**
 * @type {import('entail').Suite}
 */
export const testEvaluation = {
  'plans negation last': async (assert) => {
    const db = DB.Memory.create([alice])

    const plan = Analyzer.plan({
      match: {
        manager: $.$manager,
        employee: $.$employee,
        managerName: $.$managerName,
        employeeName: $.$employeeName,
      },
      rule: {
        match: {
          manager: $.manager,
          employee: $.employee,
          managerName: $.managerName,
          employeeName: $.employeeName,
        },
        when: [
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
              when: [
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
              when: [
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
        ],
      },
    })

    const result = await Task.perform(plan.query({ source: db }))

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
      when: [
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
    })

    const plan = rule
      .apply({
        a: $.subject,
        actual: $.actual,
        b: $.subject,
        expect: $.expect,
      })
      .plan()

    const result = await Task.perform(plan.query({ source: db }))

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

  'skip test generate query': async (assert) => {
    const db = DB.Memory.create([
      {
        'Person/name': 'Alice',
        'Manages/employee': {
          'Person/name': 'Bob',
          'Manages/employee': { 'Person/name': 'Mallory' },
        },
      },
    ])

    const plan = Analyzer.plan({
      match: {
        this: $.this,
        'name.is': $['name'],
        // 'name.of': $.this,
        'manages.is.this': $['manages.is.this'],
        // 'manages.is.name.is': $['manages.is.name.is'],
        // 'manages.is.name.of': $['manages.is.name.of'],
        'manages.of': $.this,
      },
      rule: {
        match: {
          this: $.this,
          'name.is': $['name.is'],
          // 'name.of': $.this,
          'manages.is.this': $['manages.is.this'],
          // 'manages.is.name.is': $['manages.is.name.is'],
          // 'manages.is.name.of': $['manages.is.name.of'],
          'manages.of': $['manages.of'],
        },
        when: [
          {
            match: {
              is: $['name.is'],
              of: $.this,
            },
            rule: {
              match: {
                is: $.is,
                of: $.of,
              },
              when: [{ match: { the: 'Person/name', of: $.of, is: $.is } }],
            },
          },
          {
            match: {
              is: $['manages.is.this'],
              of: $['manages.of'],
            },
            rule: {
              match: {
                is: $.is,
                of: $.of,
              },
              when: [
                { match: { the: 'Manages/employee', of: $.of, is: $.is } },
              ],
            },
          },
          // {
          //   match: {
          //     'is.this': $['manages.is.this'],
          //     'is.name.is': $['manages.is.name.is'],
          //     'is.name.of': $['manages.is.name.of'],
          //     of: $.this,
          //   },
          //   rule: {
          //     match: {
          //       'is.this': $['is.this'],
          //       'is.name.is': $['is.name.is'],
          //       'is.name.of': $['is.name.of'],
          //       of: $.of,
          //     },
          //     when: [
          //       {
          //         match: {
          //           the: 'Manages/employee',
          //           of: $.of,
          //           is: $['is.this'],
          //         },
          //       },
          //       {
          //         match: {
          //           this: $['is.this'],
          //           'name.is': $['is.name.is'],
          //           'name.of': $['is.name.of'],
          //         },
          //         rule: {
          //           match: {
          //             this: $.this,
          //             'name.is': $['name.is'],
          //             'name.of': $.this,
          //           },
          //           when: [
          //             {
          //               match: {
          //                 // the: $['name.the'],
          //                 is: $['name.is'],
          //                 of: $.this,
          //               },
          //               rule: {
          //                 match: {
          //                   // the: $.the,
          //                   is: $.is,
          //                   of: $.of,
          //                 },
          //                 when: [
          //                   // {
          //                   //   match: { of: 'Person/name', is: $.the },
          //                   //   operator: '==',
          //                   // },
          //                   {
          //                     match: { the: 'Person/name', of: $.of, is: $.is },
          //                   },
          //                   // {
          //                   //   match: { of: $.is, is: 'string' },
          //                   //   operator: 'data/type',
          //                   // },
          //                 ],
          //               },
          //             },
          //           ],
          //         },
          //       },
          //     ],
          //   },
          // },
        ],
      },
    })

    const result = await Task.perform(plan.query({ source: db }))

    console.log(result)
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
