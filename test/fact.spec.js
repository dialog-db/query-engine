import { fact, same, Text, Memory, $, Math, Link, Task } from './lib.js'
import proofsDB from './proofs.db.js'
import moviesDB from './movie.db.js'
import employeeDB from './microshaft.db.js'

/**
 * @type {import('entail').Suite}
 */
export const testDB = {
  'test claim and assert derive equal this': async (assert) => {
    const Person = fact({
      name: String,
      address: String,
    })

    const Employee = fact({ name: String }).where(({ name }) => [
      Person.match({ name }),
      Employee.claim({ name }),
    ])

    const marije = Person.assert({
      name: 'Marije',
      address: 'Amsterdam, Netherlands',
    })

    const db = Memory.create([])
    await Task.perform(db.transact(marije))
    const [employee, ...none] = await Employee().query({ from: db })

    assert.deepEqual([employee, ...none], [Employee.assert({ name: 'Marije' })])
    assert.deepEqual(employee.this, Employee.assert({ name: 'Marije' }).this)
    assert.notDeepEqual(employee.this, marije.this)
  },
  'can provide explicit this': async (assert) => {
    const Person = fact({
      name: String,
      address: String,
    })

    const Employee = fact({ name: String }).where(({ this: person, name }) => [
      Person.match({ this: person, name }),
      Employee.claim({ this: person, name }),
    ])

    const marije = Person.assert({
      name: 'Marije',
      address: 'Amsterdam, Netherlands',
    })

    const db = Memory.create([])
    await Task.perform(db.transact(marije))
    const [employee, ...none] = await Employee().query({ from: db })

    assert.deepEqual(
      [employee, ...none],
      [Employee.assert({ this: marije.this, name: 'Marije' })]
    )
    assert.notDeepEqual(employee.this, Employee.assert({ name: 'Marije' }).this)
    assert.deepEqual(employee.this, marije.this)
  },
  'test fact assert': async (assert) => {
    const db = Memory.create([])

    const Person = fact({
      name: String,
      address: String,
    })

    assert.deepEqual(await Person().query({ from: db }), [], 'db is empty')

    const marije = Person.assert({
      name: 'Marije',
      address: 'Amsterdam, Netherlands',
    })

    await Task.perform(db.transact(marije))

    assert.deepEqual(
      await Person().query({ from: db }),
      [marije],
      'fact was asserted'
    )

    assert.throws(
      () =>
        // @ts-expect-error
        Person.assert({ name: 'Bob' }),
      /Required property "address" is missing/
    )

    assert.throws(
      () =>
        // @ts-expect-error
        Person.assert({ address: 'Paris, France' }),
      /Required property "name" is missing/
    )

    assert.throws(
      () =>
        // @ts-expect-error
        Person.assert({ address: 'Paris, France' }),
      /Required property .* is missing/
    )

    const paul = Person.assert({
      this: Link.of({ whatever: {} }),
      name: 'Paul',
      address: 'Paris, France',
    })

    assert.deepEqual(
      paul.this,
      Link.of({ whatever: {} }),
      'uses provided "this"'
    )

    assert.deepEqual(
      Person.assert({
        name: 'Rome',
        address: 'Florence, Italy',
      }).this,
      Person.assert({
        name: 'Rome',
        address: 'Florence, Italy',
      }).this,
      'entity generation is deterministic'
    )

    assert.notDeepEqual(
      Person.assert({
        this: Link.of({ other: 'other' }),
        name: 'Rome',
        address: 'Florence, Italy',
      }).this,
      Person.assert({
        name: 'Rome',
        address: 'Florence, Italy',
      }).this
    )
  },
  'test fact derives namespace': async (assert) => {
    const Person = fact({
      name: String,
      address: String,
    })

    const marije = {
      [`${Person.the}/name`]: 'Marije',
      [`${Person.the}/address`]: 'Amsterdam, Netherlands',
    }

    const people = await Person().query({
      from: Memory.create([marije]),
    })

    assert.deepEqual(people, [
      Person.assert({
        this: Link.of(marije),
        name: 'Marije',
        address: 'Amsterdam, Netherlands',
      }),
    ])
  },
  'test partial query': async (assert) => {
    const Person = fact({
      name: String,
      address: String,
    })

    const marije = {
      [`${Person.the}/name`]: 'Marije',
      [`${Person.the}/address`]: 'Amsterdam, Netherlands',
    }
    const bjorn = {
      [`${Person.the}/name`]: 'Bjorn',
      [`${Person.the}/address`]: 'Amsterdam, Netherlands',
    }
    const jack = {
      [`${Person.the}/name`]: 'Jack',
    }

    const db = Memory.create([marije, bjorn])
    const out = await Person.match({ name: Person.ports.name }).query({
      from: db,
    })

    assert.deepEqual(
      await Person.match({ name: 'Marije' }).query({
        from: db,
      }),
      [
        Person.assert({
          this: Link.of(marije),
          name: 'Marije',
          address: 'Amsterdam, Netherlands',
        }),
      ],
      'finds by name'
    )

    assert.deepEqual(
      await Person.match({ address: 'Amsterdam, Netherlands' }).query({
        from: db,
      }),
      [
        Person.assert({
          this: Link.of(marije),
          name: 'Marije',
          address: 'Amsterdam, Netherlands',
        }),
        Person.assert({
          this: Link.of(bjorn),
          name: 'Bjorn',
          address: 'Amsterdam, Netherlands',
        }),
      ],
      'finds by address'
    )

    assert.deepEqual(
      await Person.match({ name: $.address }).query({
        from: db,
      }),
      [
        Person.assert({
          this: Link.of(marije),
          name: 'Marije',
          address: 'Amsterdam, Netherlands',
        }),
        Person.assert({
          this: Link.of(bjorn),
          name: 'Bjorn',
          address: 'Amsterdam, Netherlands',
        }),
      ],
      'does not conflade variables'
    )
  },
  'test can provide namespace': async (assert) => {
    const Person = fact({
      the: 'person',
      name: String,
      address: String,
    })

    const marije = {
      'person/name': 'Marije',
      'person/address': 'Amsterdam, Netherlands',
    }

    const people = await Person().query({
      from: Memory.create([marije]),
    })

    assert.deepEqual(people, [
      Person.assert({
        this: Link.of(marije),
        name: 'Marije',
        address: 'Amsterdam, Netherlands',
      }),
    ])
  },
  'test use in nested context': async (assert) => {
    const Person = fact({
      the: 'person',
      name: String,
      address: String,
    })

    const marije = {
      'person/name': 'Marije',
      'person/address': 'Amsterdam, Netherlands',
    }

    const bob = {
      'person/name': 'Bob',
      'person/address': 'San Francisco, CA, USA',
    }

    const Remote = Person.where(($) => [
      Person($),
      Text.match({ this: $.address, pattern: '*Netherlands' }),
    ])

    const db = Memory.create([marije, bob])

    assert.deepEqual(await Person().query({ from: db }), [
      Person.assert({
        this: Link.of(marije),
        name: 'Marije',
        address: 'Amsterdam, Netherlands',
      }),
      Person.assert({
        this: Link.of(bob),
        name: 'Bob',
        address: 'San Francisco, CA, USA',
      }),
    ])

    assert.deepEqual(await Remote().query({ from: db }), [
      Person.assert({
        this: Link.of(marije),
        name: 'Marije',
        address: 'Amsterdam, Netherlands',
      }),
    ])
  },
  'test use assert in deriviation': async (assert) => {
    const Model = fact({
      name: String,
      address: String,
    })

    const View = fact({
      the: 'person',
      name: String,
      address: String,
    })
      .with({ model: Object })
      .where(($) => [
        Model({ this: $.model, name: $.name, address: $.address }),
        View.claim({ this: $.model, name: $.name, address: $.address }),
      ])

    const marije = {
      'person/name': 'Marije',
      'person/address': 'Amsterdam, Netherlands',
    }

    const bob = {
      'person/name': 'Bob',
      'person/address': 'San Francisco, CA, USA',
    }

    const alice = {
      [`${Model.the}/name`]: 'Alice',
      [`${Model.the}/address`]: 'Paris, France',
    }

    const db = Memory.create([marije, bob, alice])
    assert.deepEqual(await View().query({ from: db }), [
      View.assert({
        this: Link.of(alice),
        name: 'Alice',
        address: 'Paris, France',
      }),
    ])
  },

  'test behavior modeling': async (assert) => {
    const Counter = fact({
      the: 'io.gozala.counter',
      count: Number,
      title: String,
    })

    const Increment = fact({
      the: 'io.gozala.increment',
      command: Object,
    })

    const Behavior = Counter.with({ lastCount: Number }).when((counter) => ({
      // If we have no counter we derive a new one.
      new: [
        Counter.not({ this: counter.this }),
        Counter.assert({
          this: Link.of({ counter: { v: 1 } }),
          count: 0,
          title: 'basic counter',
        }),
      ],
      // If we have a counter but it's note benig incremented it continues
      // as is.
      continue: [Increment.not({ this: counter.this }), Counter(counter)],
      // If there is a counter with `lastCount` for the a count and
      // there is an `Increment` fact for it this counter count is
      // incremented by one.
      increment: [
        Counter({ ...counter, count: counter.lastCount }),
        Increment({ this: counter.this, command: counter._ }),
        Math.Sum({ of: counter.lastCount, with: 1, is: counter.count }),
      ],
    }))

    const db = Memory.create([])

    const init = await Behavior().query({ from: db })
    assert.deepEqual(
      init,
      [
        Behavior.assert({
          this: Link.of({ counter: { v: 1 } }),
          count: 0,
          title: 'basic counter',
        }),
      ],
      'starts with empty counter'
    )

    await Task.perform(
      db.transact(
        Counter.assert({
          this: Link.of({ counter: { v: 1 } }),
          count: 0,
          title: 'persisted counter',
        })
      )
    )

    const idle = await Behavior().query({ from: db })
    assert.deepEqual(
      idle,
      [
        Behavior.assert({
          this: Link.of({ counter: { v: 1 } }),
          count: 0,
          title: 'persisted counter',
        }),
      ],
      'remains idle'
    )

    // Assert increment action
    await Task.perform(
      db.transact(
        Increment.assert({
          this: Link.of({ counter: { v: 1 } }),
          command: Link.of({}),
        })
      )
    )

    const increment = await Behavior().query({ from: db })
    assert.deepEqual(
      increment,
      [
        Behavior.assert({
          this: Link.of({ counter: { v: 1 } }),
          count: 1,
          title: 'persisted counter',
        }),
      ],
      'incrementns counter'
    )
  },
  'skip test ui idea': async (assert) => {
    const UI = fact({
      the: 'io.gozala.view',
      this: Object,
      ui: Object,
    })

    const Counter = fact({
      the: 'io.gozala.counter',
      count: Number,
      title: String,
    })

    const Increment = fact({
      the: 'io.gozala.increment',
      command: Object,
    })

    Increment.assert({ command: Link.of({}) })

    const View = UI.with({ count: Number }).where(($) => [
      Counter.match({ this: $.this, count: $.count }),
      View.claim({
        this: $.this,
        // @ts-expect-error
        ui: html`<div>${$.count}<button onclick=${Increment}>+</button></div>`,
      }),
    ])
  },

  'test basic fact': async (assert) => {
    assert.throws(() => fact({}), /schema must contain at least one property/i)
    assert.throws(
      () => fact({ this: Object }),
      /schema must contain at least one property/i
    )

    const tag = fact({ the: 'action' })
    assert.deepEqual(tag.assert({}).the, 'action')

    assert.throws(
      // @ts-expect-error
      () => fact({ this: Number, that: Number }),
      /Schema may not have \"this\" property that is not an entity/i
    )

    assert.throws(
      // @ts-expect-error
      () => fact({ _: Object }),
      /Schema may no have reserved \"_\" property/i
    )
  },
}
