import * as DB from 'datalogia'
import db from './microshaft.db.js'
import { $ } from 'datalogia'
import * as Analyzer from '../src/analyzer.js'
import { deduce, Fact, Text, Data } from '../src/syntax.js'
import { rule } from '../src/rule.js'

/**
 * @type {import('entail').Suite}
 */
export const testRules = {
  'test wheel rule': async (assert) => {
    const Wheel = deduce({ this: Object })
      .with({ manager: Object, employee: Object })
      .where(({ this: self, manager, employee }) => [
        Fact({ the: 'supervisor', of: manager, is: self }),
        Fact({ the: 'supervisor', of: employee, is: manager }),
      ])

    const Query = deduce({ name: String })
      .with({ wheel: Object })
      .where(({ name, wheel }) => [
        Wheel({ this: wheel }),
        Fact({ the: 'name', of: wheel, is: name }),
      ])

    assert.deepEqual(
      new Set(await Query().select({ from: db })),
      new Set([{ name: 'Bitdiddle Ben' }, { name: 'Warbucks Oliver' }])
    )
  },

  'leaves near': async (assert) => {
    const Address = deduce({ of: Object, is: String }).where(({ of, is }) => [
      Fact({ the: 'address', of, is }),
    ])

    const Name = deduce({ of: Object, is: String }).where(({ of, is }) => [
      Fact({ the: 'name', of, is }),
    ])

    const Employee = deduce({
      this: Object,
      name: String,
      address: String,
    }).where(($) => [
      Address({ of: $.this, is: $.address }),
      Name({ of: $.this, is: $.name }),
    ])

    const LivesNear = deduce({
      employee: String,
      coworker: String,
    })
      .with({
        employeeEntity: Object,
        employeeAddress: String,
        coworkerEntity: Object,
        coworkerAddress: String,
        word: String,
        pattern: String,
      })
      .where(
        ({
          employee,
          employeeEntity,
          employeeAddress,
          coworker,
          coworkerEntity,
          word,
          coworkerAddress,
          pattern,
        }) => [
          Employee.match({
            this: employeeEntity,
            address: employeeAddress,
            name: employee,
          }),
          Employee.match({
            this: coworkerEntity,
            address: coworkerAddress,
            name: coworker,
          }),
          Text.Words({ of: employeeAddress, is: word }),
          Text.Concat({ of: [word, '*'], is: pattern }),
          Text.match({ this: coworkerAddress, pattern }),
          Data.same.not({ this: employee, as: coworker }),
        ]
      )

    const matches = await LivesNear().select({ from: db })

    assert.deepEqual(
      new Set(matches),
      new Set([
        { employee: 'Bitdiddle Ben', coworker: 'Reasoner Louis' },
        { employee: 'Bitdiddle Ben', coworker: 'Aull DeWitt' },
        { employee: 'Hacker Alyssa P', coworker: 'Fect Cy D' },
        { employee: 'Fect Cy D', coworker: 'Hacker Alyssa P' },
        { employee: 'Reasoner Louis', coworker: 'Bitdiddle Ben' },
        { employee: 'Reasoner Louis', coworker: 'Aull DeWitt' },
        { employee: 'Aull DeWitt', coworker: 'Bitdiddle Ben' },
        { employee: 'Aull DeWitt', coworker: 'Reasoner Louis' },
      ])
    )
  },

  'test rules do not share a scope': async (assert) => {
    const Supervisor = rule({
      case: { this: $.this, name: $.name },
      when: [
        { Case: [$.this, 'supervisor', $.supervisor] },
        { Case: [$.supervisor, 'name', $.name] },
      ],
    })

    const match = await DB.query(db, {
      select: {
        employee: $.name,
        supervisor: $.supervisor,
      },
      where: [
        { Case: [$.employee, 'name', $.name] },
        Supervisor.match({ this: $.employee, name: $.supervisor }),
      ],
    })

    assert.deepEqual(match, [
      { employee: 'Bitdiddle Ben', supervisor: 'Warbucks Oliver' },
      { employee: 'Hacker Alyssa P', supervisor: 'Bitdiddle Ben' },
      { employee: 'Fect Cy D', supervisor: 'Bitdiddle Ben' },
      { employee: 'Tweakit Lem E', supervisor: 'Bitdiddle Ben' },
      { employee: 'Reasoner Louis', supervisor: 'Hacker Alyssa P' },
      { employee: 'Scrooge Eben', supervisor: 'Warbucks Oliver' },
      { employee: 'Cratchet Robert', supervisor: 'Scrooge Eben' },
      { employee: 'Aull DeWitt', supervisor: 'Warbucks Oliver' },
    ])
  },
}
