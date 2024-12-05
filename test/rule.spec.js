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
    const wheel = rule({
      match: { person },
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
      where: [wheel.match({ person: who }), DB.match([who, 'name', name])],
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

    const operand = DB.link()
    const same = rule({
      match: {
        operand,
        modifier: operand,
      },
    })

    const livesNear = rule({
      match: {
        employee: employee.id,
        coworker: coworker.id,
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
        DB.not(same.match({ operand: employee.id, modifier: coworker.id })),
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
        livesNear.match({
          employee: employee.id,
          coworker: coworker.id,
          city: $.city,
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
}
