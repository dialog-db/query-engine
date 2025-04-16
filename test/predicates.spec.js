import * as DB from 'datalogia'
import testDB from './microshaft.db.js'
import { deduce, Fact, Text, Data, text } from '../src/syntax.js'

/**
 * @type {import('entail').Suite}
 */
export const testMore = {
  'test facts': async (assert) => {
    const Employee = deduce({ name: String, job: String })
      .with({ of: Object })
      .where(({ of, name, job }) => [
        Fact({ the: 'name', of, is: name }),
        Fact({ the: 'job', of, is: job }),
      ])

    const job = 'Computer programmer'
    assert.deepEqual(
      await Employee({ job, name: Employee.$.name }).select({ from: testDB }),
      [
        { job, name: 'Hacker Alyssa P' },
        { job, name: 'Fect Cy D' },
      ]
    )

    const ComputerPeople = deduce({ name: String, job: String }).where(
      ({ name, job }) => [
        Employee({ name, job }),
        Text.match({ this: job, pattern: 'Computer*' }),
      ]
    )

    assert.deepEqual(await ComputerPeople().select({ from: testDB }), [
      { name: 'Bitdiddle Ben', job: 'Computer wizard' },
      { name: 'Hacker Alyssa P', job: 'Computer programmer' },
      { name: 'Fect Cy D', job: 'Computer programmer' },
      { name: 'Tweakit Lem E', job: 'Computer technician' },
      { name: 'Reasoner Louis', job: 'Computer programmer trainee' },
    ])
  },

  'test supervisor': async (assert) => {
    const Employee = deduce({
      this: Object,
      name: String,
      salary: Number,
    }).where(({ this: of, name, salary }) => [
      Fact({ the: 'name', of, is: name }),
      Fact({ the: 'salary', of, is: salary }),
    ])

    const Supervisor = deduce({
      employee: String,
      supervisor: String,
    })
      .with({ subordinate: Object, manager: Object })
      .where(({ employee, supervisor, subordinate, manager, _ }) => [
        Employee({ this: subordinate, name: employee, salary: _ }),
        Fact({ the: 'supervisor', of: subordinate, is: manager }),
        Employee({ this: manager, name: supervisor, salary: _ }),
      ])

    assert.deepEqual(await Supervisor().select({ from: testDB }), [
      { employee: 'Hacker Alyssa P', supervisor: 'Bitdiddle Ben' },
      { employee: 'Fect Cy D', supervisor: 'Bitdiddle Ben' },
      { employee: 'Tweakit Lem E', supervisor: 'Bitdiddle Ben' },
      { employee: 'Reasoner Louis', supervisor: 'Hacker Alyssa P' },
      { employee: 'Bitdiddle Ben', supervisor: 'Warbucks Oliver' },
      { employee: 'Scrooge Eben', supervisor: 'Warbucks Oliver' },
      { employee: 'Cratchet Robert', supervisor: 'Scrooge Eben' },
      { employee: 'Aull DeWitt', supervisor: 'Warbucks Oliver' },
    ])

    assert.deepEqual(
      await Supervisor.match({ employee: DB.$.q }).select({ from: testDB }),
      [
        { employee: 'Hacker Alyssa P' },
        { employee: 'Fect Cy D' },
        { employee: 'Tweakit Lem E' },
        { employee: 'Reasoner Louis' },
        { employee: 'Bitdiddle Ben' },
        { employee: 'Scrooge Eben' },
        { employee: 'Cratchet Robert' },
        { employee: 'Aull DeWitt' },
      ]
    )

    assert.deepEqual(await Supervisor().select({ from: testDB }), [
      { employee: 'Hacker Alyssa P', supervisor: 'Bitdiddle Ben' },
      { employee: 'Fect Cy D', supervisor: 'Bitdiddle Ben' },
      { employee: 'Tweakit Lem E', supervisor: 'Bitdiddle Ben' },
      { employee: 'Reasoner Louis', supervisor: 'Hacker Alyssa P' },
      { employee: 'Bitdiddle Ben', supervisor: 'Warbucks Oliver' },
      { employee: 'Scrooge Eben', supervisor: 'Warbucks Oliver' },
      { employee: 'Cratchet Robert', supervisor: 'Scrooge Eben' },
      { employee: 'Aull DeWitt', supervisor: 'Warbucks Oliver' },
    ])

    assert.deepEqual(
      await Supervisor.match({
        ...Supervisor.$,
        supervisor: 'Warbucks Oliver',
      }).select({
        from: testDB,
      }),
      [
        { employee: 'Bitdiddle Ben', supervisor: 'Warbucks Oliver' },
        { employee: 'Scrooge Eben', supervisor: 'Warbucks Oliver' },
        { employee: 'Aull DeWitt', supervisor: 'Warbucks Oliver' },
      ]
    )
  },

  'test salary': async (assert) => {
    const Employee = deduce({
      this: Object,
      name: String,
      salary: Number,
    }).where(({ this: of, name, salary }) => [
      Fact({ the: 'name', of, is: name }),
      Fact({ the: 'salary', of, is: salary }),
    ])

    const NonPoorEmployees = deduce({ name: String, salary: Number }).where(
      ({ name, salary }) => [
        Employee.match({ name, salary }),
        Data.greater({ this: salary, than: 30_000 }),
      ]
    )

    assert.deepEqual(await NonPoorEmployees().select({ from: testDB }), [
      { name: 'Bitdiddle Ben', salary: 60_000 },
      { name: 'Hacker Alyssa P', salary: 40_000 },
      { name: 'Fect Cy D', salary: 35_000 },
      { name: 'Warbucks Oliver', salary: 150_000 },
      { name: 'Scrooge Eben', salary: 75_000 },
    ])

    const L2Employees = NonPoorEmployees.when((employee) => [
      Data.less({ this: employee.salary, than: 100_000 }),
    ])

    assert.deepEqual(await L2Employees().select({ from: testDB }), [
      { name: 'Bitdiddle Ben', salary: 60_000 },
      { name: 'Hacker Alyssa P', salary: 40_000 },
      { name: 'Fect Cy D', salary: 35_000 },
      { name: 'Scrooge Eben', salary: 75_000 },
    ])
  },
  'test address': async (assert) => {
    const Employee = deduce({
      this: Object,
      name: String,
      address: String,
    }).where((employee) => [
      Fact({ the: 'name', of: employee.this, is: employee.name }),
      Fact({ the: 'address', of: employee.this, is: employee.address }),
    ])

    const WhoLivesInCambridge = deduce({
      name: String,
      address: String,
    }).where(({ name, address }) => [
      Employee.match({ name, address }),
      Text.includes({ this: address, slice: 'Campridge' }),
    ])

    assert.deepEqual(await WhoLivesInCambridge().select({ from: testDB }), [
      { name: 'Hacker Alyssa P', address: 'Campridge, Mass Ave 78' },
      { name: 'Fect Cy D', address: 'Campridge, Ames Street 3' },
    ])
  },
  'test employee with non comp supervisor ': async (assert) => {
    const Employee = deduce({
      this: Object,
      name: String,
      job: String,
    }).where(({ name, job, this: of }) => [
      Fact({ the: 'name', of, is: name }),
      Fact({ the: 'job', of, is: job }),
    ])

    const Query = deduce({
      employeeName: String,
      supervisorName: String,
    })
      .with({
        employee: Object,
        employeeJob: String,
        supervisor: Object,
        supervisorJob: String,
      })
      .where(($) => [
        Employee.match({
          this: $.employee,
          name: $.employeeName,
          job: $.employeeJob,
        }),
        Fact({ the: 'supervisor', of: $.employee, is: $.supervisor }),
        Employee.match({
          this: $.supervisor,
          name: $.supervisorName,
          job: $.supervisorJob,
        }),
        Text.match({ this: $.employeeJob, pattern: 'Computer*' }),
        Text.not({ this: $.supervisorJob, pattern: 'Computer*' }),
      ])

    assert.deepEqual(await Query().select({ from: testDB }), [
      {
        employeeName: 'Bitdiddle Ben',
        supervisorName: 'Warbucks Oliver',
      },
    ])
  },
}
