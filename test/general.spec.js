import { deduce as derive, Data, match, Text, Memory, $ } from './lib.js'
import * as Link from '../src/data/link.js'
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
      can: String,
      space: String,
    })
      .with({ capabilities: Object, capability: Object })
      .where(({ this: ucan, cid, capabilities, capability, space, can }) => [
        match({ the: 'cid', of: ucan, is: cid }),
        match({ the: 'capabilities', of: ucan, is: capabilities }),
        match({ of: capabilities, is: capability }),
        match({ the: 'can', of: capability, is: can }),
        match({ the: 'with', of: capability, is: space }),
      ])

    const Query = derive({
      space: String,
      upload: String,
      store: String,
    }).where(({ space, upload, store }) => [
      Delegation.match({ space, can: 'upload/add', cid: upload }),
      Delegation.match({ space, can: 'store/add', cid: store }),
    ])

    const result = await Query().query({ from: proofsDB })
    assert.deepEqual(result, [
      {
        upload: 'bafy...upload',
        store: 'bafy...store',
        space: 'did:key:zAlice',
      },
    ])
  },

  'test basic': async (assert) => {
    const db = Memory.create([
      [Link.of('sally'), 'age', 21],
      [Link.of('fred'), 'age', 42],
      [Link.of('ethel'), 'age', 42],
      [Link.of('fred'), 'likes', 'pizza'],
      [Link.of('sally'), 'likes', 'opera'],
      [Link.of('ethel'), 'likes', 'sushi'],
    ])

    const Query = derive({ e: Object }).where(({ e }) => [
      match({ the: 'age', of: e, is: 42 }),
    ])

    assert.deepEqual(await Query().query({ from: db }), [
      { e: Link.of('fred') },
      { e: Link.of('ethel') },
    ])

    const Likes = derive({ x: String }).where(({ x }) => [
      match({ the: 'likes', is: x }),
    ])

    assert.deepEqual(await Likes().query({ from: db }), [
      { x: 'pizza' },
      { x: 'opera' },
      { x: 'sushi' },
    ])
  },

  'sketch pull pattern': async (assert) => {
    const Person = derive({ this: Object, name: String }).where(
      ({ this: person, name }) => [
        match({ the: 'person/name', of: person, is: name }),
      ]
    )

    const Movie = derive({
      this: Object,
      cast: Object,
      director: Object,
      title: String,
    }).where(({ this: movie, cast, title, director }) => [
      match({ the: 'movie/cast', of: movie, is: cast }),
      match({ the: 'movie/director', of: movie, is: director }),
      match({ the: 'movie/title', of: movie, is: title }),
    ])

    const Query = derive({ title: String, director: String })
      .with({ actor: Object, by: Object })
      .where(({ title, director, by, actor }) => [
        Movie.match({ cast: actor, director: by, title }),
        Person({ this: by, name: director }),
        Person({ this: actor, name: 'Arnold Schwarzenegger' }),
      ])

    assert.deepEqual(
      new Set(await Query().query({ from: moviesDB })),
      new Set([
        { director: 'James Cameron', title: 'The Terminator' },
        { director: 'James Cameron', title: 'Terminator 2: Judgment Day' },
        { director: 'John McTiernan', title: 'Predator' },
        { director: 'Mark L. Lester', title: 'Commando' },
        {
          director: 'Jonathan Mostow',
          title: 'Terminator 3: Rise of the Machines',
        },
      ])
    )

    const RefinedQuery = Query.when(({ director }) => [
      Data.same.not({ this: 'James Cameron', as: director }),
    ])
    assert.deepEqual(await RefinedQuery().query({ from: moviesDB }), [
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
      .where(({ employee, name }) => [
        match({ the: 'job', of: employee, is: 'Computer programmer' }),
        match({ the: 'name', of: employee, is: name }),
      ])

    assert.deepEqual(await Programmer().query({ from: employeeDB }), [
      { name: 'Hacker Alyssa P' },
      { name: 'Fect Cy D' },
    ])
  },

  'test supervisor': async (assert) => {
    const Employee = derive({
      this: Object,
      name: String,
    }).where(({ name, this: employee }) => [
      match({ the: 'name', of: employee, is: name }),
    ])

    const Supervisor = derive({
      employee: String,
      supervisor: String,
    })
      .with({ manager: Object, subordinate: Object })
      .where(({ supervisor, employee, subordinate, manager }) => [
        Employee({ this: subordinate, name: employee }),
        match({ the: 'supervisor', of: subordinate, is: manager }),
        Employee({ this: manager, name: supervisor }),
      ])
    assert.deepEqual(
      new Set(await Supervisor().query({ from: employeeDB })),
      new Set([
        { employee: 'Hacker Alyssa P', supervisor: 'Bitdiddle Ben' },
        { employee: 'Fect Cy D', supervisor: 'Bitdiddle Ben' },
        { employee: 'Tweakit Lem E', supervisor: 'Bitdiddle Ben' },
        { employee: 'Reasoner Louis', supervisor: 'Hacker Alyssa P' },
        { employee: 'Bitdiddle Ben', supervisor: 'Warbucks Oliver' },
        { employee: 'Scrooge Eben', supervisor: 'Warbucks Oliver' },
        { employee: 'Aull DeWitt', supervisor: 'Warbucks Oliver' },
        { employee: 'Cratchet Robert', supervisor: 'Scrooge Eben' },
      ])
    )
  },

  'test salary': async (assert) => {
    const Employee = derive({
      name: String,
      salary: Number,
    })
      .with({ this: Object })
      .where(({ name, this: employee, salary }) => [
        match({ the: 'name', of: employee, is: name }),
        match({ the: 'salary', of: employee, is: salary }),
      ])

    const Above30K = Employee.when(({ salary }) => [
      Data.greater({ this: salary, than: 30_000 }),
    ])

    assert.deepEqual(await Above30K().query({ from: employeeDB }), [
      { name: 'Bitdiddle Ben', salary: 60_000 },
      { name: 'Hacker Alyssa P', salary: 40_000 },
      { name: 'Fect Cy D', salary: 35_000 },
      { name: 'Warbucks Oliver', salary: 150_000 },
      { name: 'Scrooge Eben', salary: 75_000 },
    ])

    const Between30_100K = Above30K.when(({ salary }) => [
      Data.less({ this: salary, than: 100_000 }),
    ])

    assert.deepEqual(await Between30_100K().query({ from: employeeDB }), [
      { name: 'Bitdiddle Ben', salary: 60_000 },
      { name: 'Hacker Alyssa P', salary: 40_000 },
      { name: 'Fect Cy D', salary: 35_000 },
      { name: 'Scrooge Eben', salary: 75_000 },
    ])
  },

  'test disjunction': async (assert) => {
    const Employee = derive({ this: Object, name: String }).where(
      ({ this: employee, name }) => [
        match({ the: 'name', of: employee, is: name }),
      ]
    )

    const Supervisor = derive({ this: Object, name: String, of: Object }).where(
      ({ this: supervisor, of, name }) => [
        Employee({ this: supervisor, name }),
        match({ the: 'supervisor', of, is: supervisor }),
      ]
    )

    const Ben = Supervisor.when(({ name }) => [
      Data.same({ this: 'Bitdiddle Ben', as: name }),
    ])
    const Alyssa = Supervisor.when(({ name }) => [
      Data.same({ this: 'Hacker Alyssa P', as: name }),
    ])

    const Query = derive({ employee: String, supervisor: String })
      .with({ subordinate: Object, manager: Object })
      .when(({ employee, supervisor, subordinate, manager }) => ({
        Ben: [
          Employee({ this: subordinate, name: employee }),
          Ben({ this: manager, of: subordinate, name: supervisor }),
        ],
        Alyssa: [
          Employee({ this: subordinate, name: employee }),
          Alyssa({ this: manager, of: subordinate, name: supervisor }),
        ],
      }))

    assert.deepEqual(await Query().query({ from: employeeDB }), [
      { employee: 'Hacker Alyssa P', supervisor: 'Bitdiddle Ben' },
      { employee: 'Fect Cy D', supervisor: 'Bitdiddle Ben' },
      { employee: 'Tweakit Lem E', supervisor: 'Bitdiddle Ben' },
      { employee: 'Reasoner Louis', supervisor: 'Hacker Alyssa P' },
    ])
  },

  'test negation': async (assert) => {
    const Query = derive({ name: String })
      .with({ supervisor: Object, employee: Object })
      .where(({ name, supervisor, employee }) => [
        match({ the: 'name', of: supervisor, is: 'Bitdiddle Ben' }),
        match({ the: 'supervisor', of: employee, is: supervisor }),
        match({ the: 'name', of: employee, is: name }),
        match.not({ the: 'job', of: employee, is: 'Computer programmer' }),
      ])

    assert.deepEqual(await Query().query({ from: employeeDB }), [
      { name: 'Tweakit Lem E' },
    ])
  },
}
