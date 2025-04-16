import db from './microshaft.db.js'
import { $, match, deduce, Memory, Text, Data, same } from './lib.js'

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
    assert.deepEqual(await same({ this: 1, as: $.q }).query({ from: db }), [
      { this: 1, as: 1 },
    ])

    assert.deepEqual(await same({ this: $.q, as: 2 }).query({ from: db }), [
      { this: 2, as: 2 },
    ])

    assert.throws(
      () => same({ this: $.q, as: $.q2 }).query({ from: db }),
      /Rule application requires binding for \?this/
    )
  },
  'test basic': async (assert) => {
    const Name = deduce({ of: Object, is: String }).where(({ of, is }) => [
      match({ the: 'name', of, is }),
    ])

    const Alyssa = deduce({ of: Object, name: String }).where(
      ({ of, name }) => [
        Data.same({ this: 'Hacker Alyssa P', as: name }),
        Name({ of, is: name }),
      ]
    )

    assert.deepEqual(await Alyssa().query({ from: db }), [
      { of: Memory.entity(1), name: 'Hacker Alyssa P' },
    ])
  },

  'test wheel rule': async (assert) => {
    const Wheel = deduce({ this: Object })
      .with({ manager: Object, employee: Object })
      .where(({ this: self, manager, employee }) => [
        match({ the: 'supervisor', of: manager, is: self }),
        match({ the: 'supervisor', of: employee, is: manager }),
      ])

    const Query = deduce({ name: String })
      .with({ wheel: Object })
      .where(({ name, wheel }) => [
        Wheel({ this: wheel }),
        match({ the: 'name', of: wheel, is: name }),
      ])

    assert.deepEqual(
      new Set(await Query().query({ from: db })),
      new Set([{ name: 'Bitdiddle Ben' }, { name: 'Warbucks Oliver' }])
    )
  },

  'leaves near': async (assert) => {
    const Address = deduce({ of: Object, is: String }).where(({ of, is }) => [
      match({ the: 'address', of, is }),
    ])

    const Name = deduce({ of: Object, is: String }).where(({ of, is }) => [
      match({ the: 'name', of, is }),
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

    const matches = await LivesNear().query({ from: db })

    assert.deepEqual(
      matches.map((match) => JSON.stringify(match)).sort(),
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
        .map(($) => JSON.stringify($))
        .sort()
    )
  },

  'test rules do not share a scope': async (assert) => {
    const Supervisor = deduce({
      employee: Object,
      name: String,
    })
      .with({ supervisor: Object })
      .where(({ employee, supervisor, name }) => [
        match({ the: 'supervisor', of: employee, is: supervisor }),
        match({ the: 'name', of: supervisor, is: name }),
      ])

    const Query = deduce({
      employee: String,
      supervisor: String,
    })
      .with({ $employee: Object })
      .where(({ supervisor, employee, $employee }) => [
        match({ the: 'name', of: $employee, is: employee }),
        Supervisor({ employee: $employee, name: supervisor }),
      ])

    assert.deepEqual(await Query().query({ from: db }), [
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

  'test composite facts': async (assert) => {
    const Name = deduce({ of: Object, is: String }).where(({ of, is }) => [
      match({ the: 'Person/name', of, is }),
    ])

    const Person = deduce({ this: Object, name: String }).where(
      ({ this: person, name }) => [Name({ of: person, is: name })]
    )

    const Manages = deduce({
      manager: String,
      employee: String,
    })
      .with({ $employee: Object, $manager: Object })
      .where(({ $manager, manager, $employee, employee }) => [
        Person({ this: $employee, name: employee }),
        match({ the: 'Manages/employee', of: $manager, is: $employee }),
        Person({ this: $manager, name: manager }),
      ])

    assert.deepEqual(await Manages().query({ from: Memory.create([alice]) }), [
      { manager: 'Alice', employee: 'Bob' },
      { manager: 'Bob', employee: 'Mallory' },
    ])

    assert.deepEqual(
      await Manages({ employee: 'Bob', manager: $ }).query({
        from: Memory.create([alice]),
      }),
      [{ manager: 'Alice', employee: 'Bob' }]
    )
  },
}
