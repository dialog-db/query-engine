import { Data, same, Memory, fact, Collection, Task, $ } from './lib.js'
import * as Link from '../src/data/link.js'
import proofsDB from './proofs.db.js'
import moviesDB from './movie.db.js'
import * as Microshaft from './microshaft.db.js'

/**
 * @type {import('entail').Suite}
 */
export const testDB = {
  'capabilities across ucans': async (assert) => {
    const UCAN = fact({
      the: 'ucan',
      cid: String,
      issuer: String,
      audience: String,
      expiration: Number,
      capabilities: Object,
    })

    const Capability = fact({
      the: 'capability',
      can: String,
      with: String,
    })

    const Delegation = fact({
      this: Object,
      cid: String,
      can: String,
      space: String,
    })
      .with({ capabilities: Object, capability: Object })
      .where(({ this: ucan, cid, capabilities, capability, space, can }) => [
        UCAN.match({ this: ucan, cid, capabilities }),
        Collection.match({ this: capabilities, of: capability }),
        Capability.match({ this: capability, can, with: space }),
      ])

    const Access = fact({
      space: String,
      upload: String,
      store: String,
    }).where(({ space, upload, store }) => [
      Delegation.match({ space, can: 'upload/add', cid: upload }),
      Delegation.match({ space, can: 'store/add', cid: store }),
      Access.claim({ space, upload, store }),
    ])

    const [...access] = await Access().query({ from: proofsDB })
    assert.deepEqual(
      access.map((fact) => fact.toJSON()),
      [
        Access.assert({
          upload: 'bafy...upload',
          store: 'bafy...store',
          space: 'did:key:zAlice',
        }).toJSON(),
      ]
    )
  },

  'test basic': async (assert) => {
    const db = Memory.create()

    const Age = fact({ age: Number })
    const Likes = fact({ likes: String })

    const fred = Link.of('fred')
    const sally = Link.of('sally')
    const ethel = Link.of('ethel')
    const marije = Link.of('marije')

    Task.perform(
      db.transact([
        ...Age.assert({ this: sally, age: 21 }),
        ...Age.assert({ this: fred, age: 42 }),
        ...Age.assert({ this: ethel, age: 42 }),
        ...Likes.assert({ this: fred, likes: 'pizza' }),
        ...Likes.assert({ this: sally, likes: 'opera' }),
        ...Likes.assert({ this: ethel, likes: 'sushi' }),
        ...Likes.assert({ this: marije, likes: 'opera' }),
      ])
    )

    assert.deepEqual(await Age.match({ age: 42 }).query({ from: db }), [
      Age.assert({ this: fred, age: 42 }),
      Age.assert({ this: ethel, age: 42 }),
    ])

    assert.deepEqual(await Likes().query({ from: db }), [
      Likes.assert({ this: fred, likes: 'pizza' }),
      Likes.assert({ this: sally, likes: 'opera' }),
      Likes.assert({ this: ethel, likes: 'sushi' }),
      Likes.assert({ this: marije, likes: 'opera' }),
    ])

    assert.deepEqual(
      await Likes.match({ likes: 'pizza' }).query({ from: db }),
      [Likes.assert({ this: fred, likes: 'pizza' })]
    )

    assert.deepEqual(await Likes.match({ this: ethel }).query({ from: db }), [
      Likes.assert({ this: ethel, likes: 'sushi' }),
    ])

    const Alike = fact({
      as: Object,
      likes: String,
    }).where(({ this: self, likes, as }) => [
      Likes.match({ this: self, likes }),
      Likes.match({ this: as, likes }),
      same.not({ this: self, as }),
    ])

    assert.deepEqual(await Alike().query({ from: db }), [
      Alike.assert({ this: sally, as: marije, likes: 'opera' }),
      Alike.assert({ this: marije, as: sally, likes: 'opera' }),
    ])
  },

  'sketch pull pattern': async (assert) => {
    const Person = fact({
      the: 'person',
      this: Object,
      name: String,
    })

    const Movie = fact({
      the: 'movie',
      this: Object,
      cast: Object,
      director: Object,
      title: String,
    })

    const Cast = fact({
      title: String,
      director: String,
      actor: String,
    })
      .with({ cast: Object, directedBy: Object })
      .where(({ title, cast, directedBy, director, actor }) => [
        Movie({ cast, director: directedBy, title }),
        Person({ this: directedBy, name: director }),
        Person({ this: cast, name: actor }),
        Cast.claim({ title, actor, director }),
      ])

    const arnold = 'Arnold Schwarzenegger'
    assert.deepEqual(
      await Cast.match({ actor: arnold }).query({ from: moviesDB }),
      [
        Cast.assert({
          title: 'The Terminator',
          director: 'James Cameron',
          actor: arnold,
        }),
        Cast.assert({
          title: 'Terminator 2: Judgment Day',
          director: 'James Cameron',
          actor: arnold,
        }),
        Cast.assert({
          title: 'Predator',
          director: 'John McTiernan',
          actor: arnold,
        }),
        Cast.assert({
          title: 'Commando',
          director: 'Mark L. Lester',
          actor: arnold,
        }),
        Cast.assert({
          title: 'Terminator 3: Rise of the Machines',
          director: 'Jonathan Mostow',
          actor: arnold,
        }),
      ]
    )

    const CastExceptCameron = Cast.where(
      ({ this: $, title, director, actor }) => [
        Cast({ this: $, title, director, actor }),
        same.not({ this: 'James Cameron', as: director }),
      ]
    )

    assert.deepEqual(
      await CastExceptCameron.match({ actor: arnold }).query({
        from: moviesDB,
      }),
      [
        Cast.assert({
          director: 'John McTiernan',
          title: 'Predator',
          actor: arnold,
        }),
        Cast.assert({
          director: 'Mark L. Lester',
          title: 'Commando',
          actor: arnold,
        }),
        Cast.assert({
          director: 'Jonathan Mostow',
          title: 'Terminator 3: Rise of the Machines',
          actor: arnold,
        }),
      ]
    )
  },

  'test facts': async (assert) => {
    const Person = fact({
      the: 'person',
      name: String,
    })

    const Job = fact({
      the: 'job',
      title: String,
      salary: Number,
    })

    const Employee = fact({
      name: String,
      job: String,
    }).where(({ this: $, name, job }) => [
      Person({ this: $, name }),
      Job.match({ this: $, title: job }),
    ])

    const Programmer = fact({
      name: String,
    }).where(({ this: employee, name }) => [
      Employee({ this: employee, name: name, job: 'Computer programmer' }),
    ])

    assert.deepEqual(await Programmer().query({ from: Microshaft.db }), [
      Programmer.assert({
        this: Link.of(Microshaft.alyssa),
        name: 'Hacker Alyssa P',
      }),
      Programmer.assert({
        this: Link.of(Microshaft.cy),
        name: 'Fect Cy D',
      }),
    ])
  },

  'test supervisor': async (assert) => {
    const Person = fact({
      the: 'person',
      name: String,
    })

    const Job = fact({
      the: 'job',
      title: String,
    })

    const Supervisor = fact({
      the: 'job',
      supervisor: Object,
    })

    const Employee = fact({
      name: String,
    }).where(({ this: $, name }) => [
      Person({ this: $, name }),
      Job.match({ this: $ }),
    ])

    const Manager = fact({
      employee: String,
      manager: String,
    })
      .with({ supervisor: Object, subordinate: Object })
      .where(({ supervisor, employee, subordinate, manager }) => [
        Employee({ this: subordinate, name: employee }),
        Employee({ this: supervisor, name: manager }),
        Supervisor({ this: subordinate, supervisor }),
        Manager.claim({ employee, manager }),
      ])

    assert.deepEqual(await Manager().query({ from: Microshaft.db }), [
      Manager.assert({
        employee: 'Scrooge Eben',
        manager: 'Warbucks Oliver',
      }),
      Manager.assert({
        employee: 'Cratchet Robert',
        manager: 'Scrooge Eben',
      }),
      Manager.assert({
        employee: 'Bitdiddle Ben',
        manager: 'Warbucks Oliver',
      }),

      Manager.assert({
        employee: 'Hacker Alyssa P',
        manager: 'Bitdiddle Ben',
      }),
      Manager.assert({
        employee: 'Fect Cy D',
        manager: 'Bitdiddle Ben',
      }),
      Manager.assert({
        employee: 'Tweakit Lem E',
        manager: 'Bitdiddle Ben',
      }),
      Manager.assert({
        employee: 'Reasoner Louis',
        manager: 'Hacker Alyssa P',
      }),

      Manager.assert({
        employee: 'Aull DeWitt',
        manager: 'Warbucks Oliver',
      }),
    ])
  },

  'test salary': async (assert) => {
    const Person = fact({
      the: 'person',
      name: String,
    })

    const Job = fact({
      the: 'job',
      salary: Number,
    })

    const Employee = fact({
      name: String,
      salary: Number,
    }).where(({ this: employee, name, salary }) => [
      Person({ this: employee, name }),
      Job({ this: employee, salary }),
    ])

    const Above30K = Employee.where(({ this: employee, name, salary }) => [
      Employee({ this: employee, name, salary }),
      Data.greater({ this: salary, than: 30_000 }),
    ])

    assert.deepEqual(await Above30K().query({ from: Microshaft.db }), [
      Employee.assert({
        this: Link.of(Microshaft.oliver),
        name: 'Warbucks Oliver',
        salary: 150_000,
      }),
      Employee.assert({
        this: Link.of(Microshaft.eben),
        name: 'Scrooge Eben',
        salary: 75_000,
      }),
      Employee.assert({
        this: Link.of(Microshaft.ben),
        name: 'Bitdiddle Ben',
        salary: 60_000,
      }),
      Employee.assert({
        this: Link.of(Microshaft.alyssa),
        name: 'Hacker Alyssa P',
        salary: 40_000,
      }),
      Employee.assert({
        this: Link.of(Microshaft.cy),
        name: 'Fect Cy D',
        salary: 35_000,
      }),
    ])

    const Between30_100K = Above30K.where(
      ({ this: employee, name, salary }) => [
        Above30K({ this: employee, name, salary }),
        Data.less({ this: salary, than: 100_000 }),
      ]
    )

    assert.deepEqual(await Between30_100K().query({ from: Microshaft.db }), [
      Employee.assert({
        this: Link.of(Microshaft.eben),
        name: 'Scrooge Eben',
        salary: 75_000,
      }),
      Employee.assert({
        this: Link.of(Microshaft.ben),
        name: 'Bitdiddle Ben',
        salary: 60_000,
      }),
      Employee.assert({
        this: Link.of(Microshaft.alyssa),
        name: 'Hacker Alyssa P',
        salary: 40_000,
      }),
      Employee.assert({
        this: Link.of(Microshaft.cy),
        name: 'Fect Cy D',
        salary: 35_000,
      }),
    ])
  },

  'test disjunction': async (assert) => {
    const Person = fact({
      the: 'person',
      name: String,
    })

    const Supervisor = fact({
      the: 'job',
      supervisor: Object,
    })

    const Manager = fact({
      employee: String,
      manager: String,
    })
      .with({ supervisor: Object, subordinate: Object })
      .where(({ employee, manager, supervisor, subordinate }) => [
        Person({ this: subordinate, name: employee }),
        Person({ this: supervisor, name: manager }),
        Supervisor({ this: subordinate, supervisor }),
        Manager.claim({ employee, manager }),
      ])

    Manager.build().toDebugString()

    const ReportingToBenOrAlyssa = Manager.when(
      ({ this: fact, employee, manager }) => ({
        Ben: [
          Manager({ this: fact, employee, manager }),
          same({ this: manager, as: 'Bitdiddle Ben' }),
        ],
        Alyssa: [
          Manager({ this: fact, employee, manager }),
          same({ this: manager, as: 'Hacker Alyssa P' }),
        ],
      })
    )

    assert.deepEqual(
      await ReportingToBenOrAlyssa().query({ from: Microshaft.db }),
      [
        ReportingToBenOrAlyssa.assert({
          employee: 'Hacker Alyssa P',
          manager: 'Bitdiddle Ben',
        }),
        ReportingToBenOrAlyssa.assert({
          employee: 'Fect Cy D',
          manager: 'Bitdiddle Ben',
        }),
        ReportingToBenOrAlyssa.assert({
          employee: 'Tweakit Lem E',
          manager: 'Bitdiddle Ben',
        }),
        ReportingToBenOrAlyssa.assert({
          employee: 'Reasoner Louis',
          manager: 'Hacker Alyssa P',
        }),
      ]
    )
  },

  'test negation': async (assert) => {
    const Person = fact({
      the: 'person',
      name: String,
    })

    const Job = fact({
      the: 'job',
      title: String,
    })

    const Supervisor = fact({
      the: 'job',
      supervisor: Object,
    })

    const NonProgrammer = Person.with({ manager: Object }).where(
      ({ this: employee, manager, name }) => [
        Person({ this: employee, name }),
        Person({ this: manager, name: 'Bitdiddle Ben' }),
        Job.not({ this: employee, title: 'Computer programmer' }),
        Supervisor({ this: employee, supervisor: manager }),
      ]
    )

    assert.deepEqual(await NonProgrammer().query({ from: Microshaft.db }), [
      Person.assert({ this: Link.of(Microshaft.lem), name: 'Tweakit Lem E' }),
    ])
  },
}
