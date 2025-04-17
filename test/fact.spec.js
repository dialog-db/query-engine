import { deduce, fact, Data, match, Text, Memory, $, schema } from './lib.js'
import proofsDB from './proofs.db.js'
import moviesDB from './movie.db.js'
import employeeDB from './microshaft.db.js'

/**
 * @type {import('entail').Suite}
 */
export const testDB = {
  'test capabilities across ucans': async (assert) => {
    const Employee = fact({
      name: String,
      address: String,
      job: String,
      salary: Number,
      supervisor: Object,
    })

    const result = await Employee.match({
      name: 'Bitdiddle Ben',
      address: $.address,
      salary: $.salary,
    }).query({
      from: employeeDB,
    })

    assert.deepEqual(result, [
      {
        name: 'Bitdiddle Ben',
        address: 'Slumerville, Ridge Road 10',
        salary: 60000,
      },
    ])
  },

  'test schema generation': async (assert) => {
    const Name = schema({
      name: String,
    })

    Name({ this: $.of, name: $.name })

    const Employee = schema({
      name: String,
      address: String,
    })

    const Person = schema({ name: String }).where(({ $, name }) => [
      Employee.name({ $, is: name }),
    ])

    Person.only({ this: $.me, name: $.name })

    Person({ this: $.me, name: $.name })
    Person({ this: $.me }).name($.name)

    Person.name({ of: $.me, is: $.name })

    const model = schema({
      in: 'io.gozala',
      none: null,
      title: String,
      count: Number,
      done: Boolean,
      signature: Uint8Array,
      volume: BigInt,
      the: Symbol,

      unit: {},
      meta: {
        version: Number,
      },
    })

    console.log(model)
    // assert.deepEqual(
    //   ,
    //   {
    //     '/': 'bafyr4if7albowcvxkt5bbkqqh4e2bkh24wt2cekppi6pvwwd2tdvwnhm6a',
    //     in: 'io.gozala',
    //     none: { Null: {} },
    //     title: { String: {} },
    //     count: { Integer: {} },
    //     done: { Boolean: {} },
    //     signature: { Bytes: {} },
    //     volume: { Integer: {} },
    //     the: { Name: {} },
    //     unit: {
    //       '/': 'bafyr4ia7stf7ge5tzyrsk6tskhva7sk2erkw5jqr4t4pi5pfjglrxlw3ai',
    //     },

    //     meta: {
    //       '/': 'bafyr4if2sve4tuhi4s72tumdxj7eyh7z4msxnrl7vw52ki5cc4jjbncqwy',
    //       version: { Integer: {} },
    //     },
    //   }
    // )
  },
  'skip test data modeling': async (assert) => {
    const Person = schema({
      name: String,
    })

    const alice = Person.assert({ name: 'Alice' })

    const [fact] = await Person({ name: 'Alice' }).query({ from: employeeDB })

    fact.assert({ address: '123 Main St' })

    alice.assert({ name: 'Alice' })

    Person.assert({ name: 'Bob' })

    Person.retract({ this: alice.this, name: 'Alice' })
  },
}
