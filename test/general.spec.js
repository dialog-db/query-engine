import * as DB from 'datalogia'
import { assert as derive, Data, Fact, Text } from '../src/syntax.js'
import * as Link from '../src/link.js'
import proofsDB from './proofs.db.js'
import moviesDB from './movie.db.js'
import employeeDB from './microshaft.db.js'

/**
 * @type {import('entail').Suite}
 */
export const testDB = {
  'test capabilities across ucans': async (assert) => {
    const Delegation = derive({
      this: Object,
      cid: String,
      can: Object,
      space: String,
    })
      .with({ capabilities: Object, capability: Object })
      .when(({ this: ucan, cid, capabilities, capability, space, can }) => [
        Fact({ the: 'cid', of: ucan, is: cid }),
        Fact({ the: 'capabilities', of: ucan, is: capabilities }),
        Fact({ of: capabilities, is: capability }),
        Fact({ the: 'can', of: capability, is: can }),
        Fact({ the: 'with', of: capability, is: space }),
      ])

    const Query = derive({
      space: String,
      upload: String,
      store: String,
    }).when(({ space, upload, store }) => [
      Delegation.match({ space, can: 'upload/add', cid: upload }),
      Delegation.match({ space, can: 'store/add', cid: store }),
    ])

    const result = await Query().select({ from: proofsDB })
    assert.deepEqual(result, [
      {
        upload: 'bafy...upload',
        store: 'bafy...store',
        space: 'did:key:zAlice',
      },
    ])
  },

  'test basic': async (assert) => {
    const db = DB.Memory.create([
      [Link.of('sally'), 'age', 21],
      [Link.of('fred'), 'age', 42],
      [Link.of('ethel'), 'age', 42],
      [Link.of('fred'), 'likes', 'pizza'],
      [Link.of('sally'), 'likes', 'opera'],
      [Link.of('ethel'), 'likes', 'sushi'],
    ])

    const Query = derive({ e: Object }).when(({ e }) => [
      Fact({ the: 'age', of: e, is: 42 }),
    ])

    assert.deepEqual(await Query().select({ from: db }), [
      { e: Link.of('fred') },
      { e: Link.of('ethel') },
    ])

    const Likes = derive({ x: String }).when(({ x }) => [
      Fact({ the: 'likes', is: x }),
    ])

    assert.deepEqual(await Likes().select({ from: db }), [
      { x: 'pizza' },
      { x: 'opera' },
      { x: 'sushi' },
    ])
  },

  'sketch pull pattern': async (assert) => {
    const Person = derive({ this: Object, name: String }).when(
      ({ this: person, name }) => [
        Fact({ the: 'person/name', of: person, is: name }),
      ]
    )

    const Movie = derive({
      this: Object,
      cast: Object,
      director: String,
      title: String,
    }).when(({ this: movie, cast, title, director }) => [
      Fact({ the: 'movie/cast', of: movie, is: cast }),
      Fact({ the: 'movie/director', of: movie, is: director }),
      Fact({ the: 'movie/title', of: movie, is: title }),
    ])

    const Query = derive({ title: String, director: String })
      .with({ actor: Object, by: Object })
      .when(({ title, director, by, actor }) => [
        Movie.match({ cast: actor, director: by, title }),
        Person({ this: by, name: director }),
        Person({ this: actor, name: 'Arnold Schwarzenegger' }),
      ])

    assert.deepEqual(await Query().select({ from: moviesDB }), [
      { director: 'James Cameron', title: 'The Terminator' },
      { director: 'John McTiernan', title: 'Predator' },
      { director: 'Mark L. Lester', title: 'Commando' },
      { director: 'James Cameron', title: 'Terminator 2: Judgment Day' },
      {
        director: 'Jonathan Mostow',
        title: 'Terminator 3: Rise of the Machines',
      },
    ])

    const RefinedQuery = Query.when(({ director }) => [
      Data.same.not({ this: 'James Cameron', as: director }),
    ])
    assert.deepEqual(await RefinedQuery().select({ from: moviesDB }), [
      { director: 'John McTiernan', title: 'Predator' },
      { director: 'Mark L. Lester', title: 'Commando' },
      {
        director: 'Jonathan Mostow',
        title: 'Terminator 3: Rise of the Machines',
      },
    ])
  },

  'test facts': async (assert) => {
    const Programmer = derive({
      name: String,
    })
      .with({ employee: Object })
      .when(({ employee, name }) => [
        Fact({ the: 'job', of: employee, is: 'Computer programmer' }),
        Fact({ the: 'name', of: employee, is: name }),
      ])

    assert.deepEqual(await Programmer().select({ from: employeeDB }), [
      { name: 'Hacker Alyssa P' },
      { name: 'Fect Cy D' },
    ])
  },

  'test supervisor': async (assert) => {
    const Employee = derive({
      this: Object,
      name: String,
    }).when(({ name, this: employee }) => [
      Fact({ the: 'name', of: employee, is: name }),
    ])

    const Supervisor = derive({
      employee: String,
      supervisor: String,
    })
      .with({ manager: Object, subordinate: Object })
      .when(({ supervisor, employee, subordinate, manager }) => [
        Employee({ this: subordinate, name: employee }),
        Fact({ the: 'supervisor', of: subordinate, is: manager }),
        Employee({ this: manager, name: supervisor }),
      ])

    assert.deepEqual(await Supervisor().select({ from: employeeDB }), [
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

  'test salary': async (assert) => {
    const Employee = derive({
      name: String,
      salary: Number,
    })
      .with({ this: Object })
      .when(({ name, this: employee, salary }) => [
        Fact({ the: 'name', of: employee, is: name }),
        Fact({ the: 'salary', of: employee, is: salary }),
      ])

    const Above30K = Employee.when(({ salary }) => [
      Data.greater({ this: salary, than: 30_000 }),
    ])

    assert.deepEqual(await Above30K().select({ from: employeeDB }), [
      { name: 'Bitdiddle Ben', salary: 60_000 },
      { name: 'Hacker Alyssa P', salary: 40_000 },
      { name: 'Fect Cy D', salary: 35_000 },
      { name: 'Warbucks Oliver', salary: 150_000 },
      { name: 'Scrooge Eben', salary: 75_000 },
    ])

    const Between30_100K = Above30K.when(({ salary }) => [
      Data.less({ this: salary, than: 100_000 }),
    ])

    assert.deepEqual(await Between30_100K().select({ from: employeeDB }), [
      { name: 'Bitdiddle Ben', salary: 60_000 },
      { name: 'Hacker Alyssa P', salary: 40_000 },
      { name: 'Fect Cy D', salary: 35_000 },
      { name: 'Scrooge Eben', salary: 75_000 },
    ])
  },

  'skip test or': async (assert) => {
    const ben = DB.link()
    const alyssa = DB.link()
    const employee = {
      id: DB.link(),
      name: DB.string(),
    }
    const supervisor = {
      id: DB.link(),
      name: DB.string(),
    }

    const matches = await DB.query(employeeDB, {
      select: {
        name: employee.name,
        supervisor: supervisor.name,
      },
      where: [
        DB.match([ben, 'name', 'Bitdiddle Ben']),
        DB.match([alyssa, 'name', 'Hacker Alyssa P']),
        DB.or(
          DB.match([employee.id, 'supervisor', ben]),
          DB.match([employee.id, 'supervisor', alyssa])
        ),
        DB.match([employee.id, 'name', employee.name]),
        DB.match([employee.id, 'supervisor', supervisor.id]),
        DB.match([supervisor.id, 'name', supervisor.name]),
      ],
    })

    assert.deepEqual(
      [...matches],
      [
        { name: 'Hacker Alyssa P', supervisor: 'Bitdiddle Ben' },
        { name: 'Fect Cy D', supervisor: 'Bitdiddle Ben' },
        { name: 'Tweakit Lem E', supervisor: 'Bitdiddle Ben' },
        { name: 'Reasoner Louis', supervisor: 'Hacker Alyssa P' },
      ]
    )
  },

  'test negation': async (assert) => {
    const ben = {
      id: DB.link(),
      name: 'Bitdiddle Ben',
    }

    const job = {
      title: 'Computer programmer',
    }

    const employee = {
      id: DB.link(),
      name: DB.string(),
      job: DB.string(),
    }

    const Query = derive({ name: String })
      .with({ supervisor: Object, employee: Object })
      .when(({ name, supervisor, employee }) => [
        Fact({ the: 'name', of: supervisor, is: 'Bitdiddle Ben' }),
        Fact({ the: 'supervisor', of: employee, is: supervisor }),
        Fact({ the: 'name', of: employee, is: name }),
        Fact.not({ the: 'job', of: employee, is: 'Computer programmer' }),
      ])

    assert.deepEqual(await Query().select({ from: employeeDB }), [
      { name: 'Tweakit Lem E' },
    ])
  },
}
