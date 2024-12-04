import * as DB from 'datalogia'
import * as Link from '../src/link.js'
import proofsDB from './proofs.db.js'
import moviesDB from './movie.db.js'
import employeeDB from './microshaft.db.js'

/**
 * @type {import('entail').Suite}
 */
export const testDB = {
  'test capabilities across ucans': async (assert) => {
    const uploadUCAN = DB.link()
    const storeUCAN = DB.link()
    const uploadCID = DB.string()
    const storeCID = DB.string()

    const space = DB.string()
    const uploadCapabilities = DB.link()
    const storeCapabilities = DB.link()
    const uploadAdd = DB.link()
    const storeAdd = DB.link()

    const result = await DB.query(proofsDB, {
      select: {
        uploadCID,
        storeCID,
        space,
      },
      where: [
        DB.match([uploadUCAN, 'cid', uploadCID]),
        DB.match([uploadUCAN, 'capabilities', uploadCapabilities]),
        DB.match([uploadCapabilities, DB._, uploadAdd]),
        DB.match([uploadAdd, 'can', 'upload/add']),
        DB.match([uploadAdd, 'with', space]),

        DB.match([storeUCAN, 'cid', storeCID]),
        DB.match([storeUCAN, 'capabilities', storeCapabilities]),
        DB.match([storeCapabilities, DB._, storeAdd]),
        DB.match([storeAdd, 'can', 'store/add']),
        DB.match([storeAdd, 'with', space]),
      ],
    })

    assert.deepEqual(result, [
      {
        uploadCID: 'bafy...upload',
        storeCID: 'bafy...store',
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

    const e = DB.link()

    assert.deepEqual(
      await DB.query(db, {
        select: { e },
        where: [DB.match([e, 'age', 42])],
      }),
      [{ e: Link.of('fred') }, { e: Link.of('ethel') }]
    )

    const x = DB.string()
    assert.deepEqual(
      await DB.query(db, {
        select: { x },
        where: [DB.match([DB._, 'likes', x])],
      }),
      [{ x: 'pizza' }, { x: 'opera' }, { x: 'sushi' }]
    )
  },

  'sketch pull pattern': async (assert) => {
    const Person = DB.entity({
      'person/name': DB.string,
    })

    const Movie = DB.entity({
      'movie/title': DB.string,
      'movie/director': Person,
      'movie/cast': Person,
    })

    const movie = new Movie()
    const director = new Person()
    const actor = new Person()

    assert.deepEqual(
      await DB.query(moviesDB, {
        select: {
          director: director['person/name'],
          movie: movie['movie/title'],
        },
        where: [
          movie['movie/cast'].is(actor),
          movie['movie/director'].is(director),
          actor['person/name'].is('Arnold Schwarzenegger'),
        ],
      }),
      [
        { director: 'James Cameron', movie: 'The Terminator' },
        { director: 'John McTiernan', movie: 'Predator' },
        { director: 'Mark L. Lester', movie: 'Commando' },
        { director: 'James Cameron', movie: 'Terminator 2: Judgment Day' },
        {
          director: 'Jonathan Mostow',
          movie: 'Terminator 3: Rise of the Machines',
        },
      ]
    )

    assert.deepEqual(
      await DB.query(moviesDB, {
        select: {
          director: director['person/name'],
          movie: movie['movie/title'],
        },
        where: [
          actor['person/name'].is('Arnold Schwarzenegger'),
          director['person/name'].not('James Cameron'),
          movie['movie/cast'].is(actor),
          movie['movie/director'].is(director),
        ],
      }),
      [
        { director: 'John McTiernan', movie: 'Predator' },
        { director: 'Mark L. Lester', movie: 'Commando' },
        {
          director: 'Jonathan Mostow',
          movie: 'Terminator 3: Rise of the Machines',
        },
      ]
    )
  },
  'is predicate': async (assert) => {
    const arnold = DB.link()
    const director = DB.link()
    const movie = DB.link()
    const directorName = DB.string()
    const movieTitle = DB.string()

    const matches = await DB.query(moviesDB, {
      select: {
        director: directorName,
        movie: movieTitle,
      },
      where: [
        DB.match([arnold, 'person/name', 'Arnold Schwarzenegger']),
        DB.match([movie, 'movie/cast', arnold]),
        DB.match([movie, 'movie/director', director]),
        DB.match([director, 'person/name', directorName]),
        DB.match([movie, 'movie/title', movieTitle]),
      ],
    })

    assert.deepEqual(
      [...matches],
      [
        { director: 'James Cameron', movie: 'The Terminator' },
        { director: 'John McTiernan', movie: 'Predator' },
        { director: 'Mark L. Lester', movie: 'Commando' },
        { director: 'James Cameron', movie: 'Terminator 2: Judgment Day' },
        {
          director: 'Jonathan Mostow',
          movie: 'Terminator 3: Rise of the Machines',
        },
      ]
    )
  },

  'test facts': async (assert) => {
    const id = DB.link()
    const name = DB.string()
    const matches = await DB.query(employeeDB, {
      select: {
        name,
      },
      where: [
        DB.match([id, 'job', 'Computer programmer']),
        DB.match([id, 'name', name]),
      ],
    })

    assert.deepEqual(
      [...matches],
      [{ name: 'Hacker Alyssa P' }, { name: 'Fect Cy D' }]
    )
  },

  'test supervisor': async (assert) => {
    const supervisor = DB.link()
    const supervisorName = DB.string()
    const employee = DB.link()
    const employeeName = DB.string()
    const matches = await DB.query(employeeDB, {
      select: {
        employee: employeeName,
        supervisor: supervisorName,
      },
      where: [
        DB.match([employee, 'supervisor', supervisor]),
        DB.match([supervisor, 'name', supervisorName]),
        DB.match([employee, 'name', employeeName]),
      ],
    })

    assert.deepEqual(
      [...matches],
      [
        { employee: 'Hacker Alyssa P', supervisor: 'Bitdiddle Ben' },
        { employee: 'Fect Cy D', supervisor: 'Bitdiddle Ben' },
        { employee: 'Tweakit Lem E', supervisor: 'Bitdiddle Ben' },
        { employee: 'Reasoner Louis', supervisor: 'Hacker Alyssa P' },
        { employee: 'Bitdiddle Ben', supervisor: 'Warbucks Oliver' },
        { employee: 'Scrooge Eben', supervisor: 'Warbucks Oliver' },
        { employee: 'Cratchet Robert', supervisor: 'Scrooge Eben' },
        { employee: 'Aull DeWitt', supervisor: 'Warbucks Oliver' },
      ]
    )
  },

  'test salary': async (assert) => {
    const employee = {
      id: DB.link(),
      name: DB.string(),
      salary: DB.integer(),
    }

    const matches = await DB.query(employeeDB, {
      select: {
        name: employee.name,
        salary: employee.salary,
      },
      where: [
        DB.match([employee.id, 'salary', employee.salary]),
        DB.greater(employee.salary, 30_000),
        DB.match([employee.id, 'name', employee.name]),
      ],
    })

    assert.deepEqual(
      [...matches],
      [
        { name: 'Bitdiddle Ben', salary: 60_000 },
        { name: 'Hacker Alyssa P', salary: 40_000 },
        { name: 'Fect Cy D', salary: 35_000 },
        { name: 'Warbucks Oliver', salary: 150_000 },
        { name: 'Scrooge Eben', salary: 75_000 },
      ]
    )

    const matches2 = await DB.query(employeeDB, {
      select: {
        name: employee.name,
        salary: employee.salary,
      },
      where: [
        DB.match([employee.id, 'salary', employee.salary]),
        employee.salary.match({ '>': 30_000 }),
        employee.salary.match({ '<': 100_000 }),
        DB.match([employee.id, 'name', employee.name]),
      ],
    })

    assert.deepEqual(
      [...matches2],
      [
        { name: 'Bitdiddle Ben', salary: 60_000 },
        { name: 'Hacker Alyssa P', salary: 40_000 },
        { name: 'Fect Cy D', salary: 35_000 },
        { name: 'Scrooge Eben', salary: 75_000 },
      ]
    )
  },

  'test or': async (assert) => {
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

  'test not': async (assert) => {
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

    // finds all people supervised by Ben Bitdiddle who are not computer programmers
    const matches = await DB.query(employeeDB, {
      select: {
        name: employee.name,
      },
      where: [
        DB.match([ben.id, 'name', ben.name]),
        DB.match([employee.id, 'supervisor', ben.id]),
        DB.match([employee.id, 'name', employee.name]),
        DB.not(DB.match([employee.id, 'job', job.title])),
      ],
    })

    assert.deepEqual([...matches], [{ name: 'Tweakit Lem E' }])
  },
}
