import { db, staff } from './microshaft.db.js'
import { $, fact, Memory, Text, Data, same, Link } from './lib.js'

const mallory = {
  'Person/name': 'Mallory',
}

const bob = {
  'Person/name': 'Bob',
  'Manages/employee': mallory,
}

const alice = {
  'Person/name': 'Alice',
  'Manages/employee': bob,
}

/**
 * @type {import('entail').Suite}
 */
export const testRules = {
  'unifying variables': async (assert) => {
    const result = await same({ this: 1, as: $.q }).query({ from: db })
    assert.deepEqual([...result], [{ this: 1, as: 1 }])

    assert.deepEqual(
      [...(await same({ this: $.q, as: 2 }).query({ from: db }))],
      [{ this: 2, as: 2 }]
    )

    assert.throws(
      () => same({ this: $.q, as: $.q2 }).query({ from: db }),
      /Rule application requires binding for \?this/
    )
  },

  'test nested same': async (assert) => {
    const Counter = fact({ the: 'counter', count: Number })
    const Init = Counter.where((counter) => [
      Counter.not({ this: counter.this }),
      Init.claim({ count: 0 }),
    ])

    assert.deepEqual(await Init().query({ from: db }), [
      Counter.assert({ count: 0 }),
    ])
  },

  'test basic': async (assert) => {
    const Person = fact({ the: 'person', name: String })

    const Alyssa = Person.where((person) => [
      Person(person),
      Data.same({ this: 'Hacker Alyssa P', as: person.name }),
    ])

    assert.deepEqual(await Alyssa().query({ from: db }), [
      Person.assert({ this: Link.of(staff.alyssa), name: 'Hacker Alyssa P' }),
    ])
  },

  'test wheel rule': async (assert) => {
    const Supervisor = fact({ the: 'job', supervisor: Object })

    const Wheel = fact({ the: 'wheel' })
      .with({ manager: Object, employee: Object })
      .where(({ this: wheel, manager, employee }) => [
        Supervisor({ this: manager, supervisor: wheel }),
        Supervisor({ this: employee, supervisor: manager }),
        Wheel.claim({ this: wheel }),
      ])

    const Person = fact({ the: 'person', name: String })

    const Query = Person.where(({ this: wheel, name }) => [
      Wheel({ this: wheel }),
      Person({ this: wheel, name }),
    ])

    assert.deepEqual(await Query().query({ from: db }), [
      Person.assert({ this: Link.of(staff.oliver), name: 'Warbucks Oliver' }),
      Person.assert({ this: Link.of(staff.ben), name: 'Bitdiddle Ben' }),
    ])
  },

  'leaves near': async (assert) => {
    const Person = fact({ the: 'person', name: String, address: String })

    const LivesNear = fact({
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
          Person({
            this: employeeEntity,
            address: employeeAddress,
            name: employee,
          }),
          Person({
            this: coworkerEntity,
            address: coworkerAddress,
            name: coworker,
          }),
          Text.Words({ of: employeeAddress, is: word }),
          Text.Concat({ of: [word, '*'], is: pattern }),
          Text.match({ this: coworkerAddress, pattern }),
          Data.same.not({ this: employee, as: coworker }),
          LivesNear.claim({ employee, coworker }),
        ]
      )

    assert.deepEqual(await LivesNear().query({ from: db }), [
      LivesNear.assert({
        employee: 'Bitdiddle Ben',
        coworker: 'Reasoner Louis',
      }),
      LivesNear.assert({ employee: 'Bitdiddle Ben', coworker: 'Aull DeWitt' }),
      LivesNear.assert({ employee: 'Hacker Alyssa P', coworker: 'Fect Cy D' }),
      LivesNear.assert({ employee: 'Fect Cy D', coworker: 'Hacker Alyssa P' }),
      LivesNear.assert({
        employee: 'Reasoner Louis',
        coworker: 'Bitdiddle Ben',
      }),
      LivesNear.assert({ employee: 'Reasoner Louis', coworker: 'Aull DeWitt' }),
      LivesNear.assert({ employee: 'Aull DeWitt', coworker: 'Bitdiddle Ben' }),
      LivesNear.assert({ employee: 'Aull DeWitt', coworker: 'Reasoner Louis' }),
    ])
  },

  'test rules do not share a scope': async (assert) => {
    const Person = fact({ the: 'person', name: String })
    const Supervisor = fact({ the: 'job', supervisor: Object })

    const Manager = fact({
      name: String,
      employee: Object,
    }).where(({ this: manager, employee, name }) => [
      Supervisor({ this: employee, supervisor: manager }),
      Person({ this: manager, name }),
    ])

    const Report = fact({
      employee: String,
      supervisor: String,
    })
      .with({ manager: Object, subordinate: Object })
      .where(({ employee, supervisor, manager, subordinate }) => [
        Manager({ this: manager, employee: subordinate, name: supervisor }),
        Person({ this: subordinate, name: employee }),
        Report.claim({ employee, supervisor }),
      ])

    assert.deepEqual(await Report().query({ from: db }), [
      Report.assert({
        employee: 'Scrooge Eben',
        supervisor: 'Warbucks Oliver',
      }),
      Report.assert({
        employee: 'Cratchet Robert',
        supervisor: 'Scrooge Eben',
      }),
      Report.assert({
        employee: 'Bitdiddle Ben',
        supervisor: 'Warbucks Oliver',
      }),
      Report.assert({
        employee: 'Hacker Alyssa P',
        supervisor: 'Bitdiddle Ben',
      }),
      Report.assert({ employee: 'Fect Cy D', supervisor: 'Bitdiddle Ben' }),
      Report.assert({ employee: 'Tweakit Lem E', supervisor: 'Bitdiddle Ben' }),
      Report.assert({
        employee: 'Reasoner Louis',
        supervisor: 'Hacker Alyssa P',
      }),
      Report.assert({ employee: 'Aull DeWitt', supervisor: 'Warbucks Oliver' }),
    ])
  },

  'test composite facts': async (assert) => {
    const Person = fact({ the: 'Person', name: String })
    const Manages = fact({ the: 'Manages', employee: Object })

    const Position = fact({
      manager: String,
      employee: String,
    })
      .with({ subordinate: Object, supervisor: Object })
      .where(({ supervisor, manager, subordinate, employee }) => [
        Person({ this: subordinate, name: employee }),
        Person({ this: supervisor, name: manager }),
        Manages({ this: supervisor, employee: subordinate }),
        Position.claim({ manager, employee }),
      ])

    assert.deepEqual(
      await Position().query({ from: Memory.create({ alice }) }),
      [
        Position.assert({ manager: 'Alice', employee: 'Bob' }),
        Position.assert({ manager: 'Bob', employee: 'Mallory' }),
      ]
    )

    assert.deepEqual(
      await Position.match({ employee: 'Bob' }).query({
        from: Memory.create({ alice }),
      }),
      [Position.assert({ manager: 'Alice', employee: 'Bob' })]
    )
  },
}
