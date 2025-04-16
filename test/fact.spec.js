import { deduce, fact, Data, match, Text, Memory, $ } from './lib.js'
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

    console.log(result)
  },
}
