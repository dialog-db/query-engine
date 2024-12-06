import * as DB from 'datalogia'
import db from './microshaft.db.js'
import { $ } from 'datalogia'
import { rule } from '../src/rule.js'

/**
 * @type {import('entail').Suite}
 */
export const testRules = {
  'test wheel rule': async (assert) => {
    const person = DB.link()
    const manager = DB.link()
    const employee = DB.link()
    const Wheel = rule({
      case: { the: person },
      when: [
        { Case: [manager, 'supervisor', person] },
        { Case: [employee, 'supervisor', manager] },
      ],
    })

    const who = DB.link()
    const name = DB.string()

    const matches = await DB.query(db, {
      select: {
        name: name,
      },
      where: [Wheel.match({ the: who }), DB.match([who, 'name', name])],
    })

    assert.deepEqual(
      [...matches],
      [{ name: 'Bitdiddle Ben' }, { name: 'Warbucks Oliver' }]
    )
  },

  'leaves near': async (assert) => {
    const employee = {
      id: DB.link(),
      name: DB.string(),
      address: DB.string(),
      city: DB.string(),
    }

    const coworker = {
      id: DB.link(),
      name: DB.string(),
      address: DB.string(),
      city: DB.string(),
    }

    const Same = rule({
      case: { as: $ },
    })

    const LivesNear = rule({
      case: {
        the: employee.id,
        by: coworker.id,
        city: employee.city,
      },
      when: [
        DB.match([employee.id, 'address', employee.address]),
        DB.match([coworker.id, 'address', coworker.address]),
        { Match: [employee.address, 'text/words', employee.city] },
        { Match: [[employee.city, '*'], 'text/concat', $.pattern] },
        {
          Match: [{ text: coworker.address, pattern: $.pattern }, 'text/like'],
        },
        DB.not(Same.match({ this: employee.id, as: coworker.id })),
      ],
    })

    const matches = await DB.query(db, {
      select: {
        employee: employee.name,
        coworker: coworker.name,
      },
      where: [
        DB.match([employee.id, 'name', employee.name]),
        DB.match([coworker.id, 'name', coworker.name]),
        LivesNear.match({
          the: employee.id,
          by: coworker.id,
          city: employee.city,
        }),
      ],
    })

    assert.deepEqual(
      [...matches],
      [
        { employee: 'Bitdiddle Ben', coworker: 'Reasoner Louis' },
        { employee: 'Bitdiddle Ben', coworker: 'Aull DeWitt' },
        { employee: 'Hacker Alyssa P', coworker: 'Fect Cy D' },
        { employee: 'Fect Cy D', coworker: 'Hacker Alyssa P' },
        { employee: 'Reasoner Louis', coworker: 'Bitdiddle Ben' },
        { employee: 'Reasoner Louis', coworker: 'Aull DeWitt' },
        { employee: 'Aull DeWitt', coworker: 'Bitdiddle Ben' },
        { employee: 'Aull DeWitt', coworker: 'Reasoner Louis' },
      ]
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
