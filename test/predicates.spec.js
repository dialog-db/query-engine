import { db, staff } from './microshaft.db.js'
import { Text, Data, fact, Link } from './lib.js'

/**
 * @type {import('entail').Suite}
 */
export const testMore = {
  'test facts': async (assert) => {
    const Person = fact({ the: 'person', name: String })
    const Job = fact({ the: 'job', title: String })

    const Employee = fact({ name: String, job: String }).where(
      ({ this: employee, name, job }) => [
        Person({ this: employee, name }),
        Job({ this: employee, title: job }),
      ]
    )

    const job = 'Computer programmer'
    assert.deepEqual(await Employee.match({ job }).query({ from: db }), [
      Employee.assert({
        this: Link.of(staff.alyssa),
        job,
        name: 'Hacker Alyssa P',
      }),
      Employee.assert({ this: Link.of(staff.cy), job, name: 'Fect Cy D' }),
    ])

    const ComputerPeople = Employee.where(({ this: employee, name, job }) => [
      Employee({ this: employee, name, job }),
      Text.match({ this: job, pattern: 'Computer*' }),
    ])

    assert.deepEqual(await ComputerPeople().query({ from: db }), [
      Employee.assert({
        this: Link.of(staff.ben),
        name: 'Bitdiddle Ben',
        job: 'Computer wizard',
      }),
      Employee.assert({
        this: Link.of(staff.alyssa),
        name: 'Hacker Alyssa P',
        job: 'Computer programmer',
      }),
      Employee.assert({
        this: Link.of(staff.cy),
        name: 'Fect Cy D',
        job: 'Computer programmer',
      }),
      Employee.assert({
        this: Link.of(staff.lem),
        name: 'Tweakit Lem E',
        job: 'Computer technician',
      }),
      Employee.assert({
        this: Link.of(staff.louis),
        name: 'Reasoner Louis',
        job: 'Computer programmer trainee',
      }),
    ])
  },

  'test supervisor': async (assert) => {
    const Job = fact({ the: 'job', title: String, salary: Number })
    const Person = fact({ the: 'person', name: String })
    const Supervisor = fact({
      the: 'job',
      supervisor: Object,
    })

    const Employee = fact({
      name: String,
      salary: Number,
    }).where(({ this: employee, name, salary, _ }) => [
      Person({ this: employee, name }),
      Job({ this: employee, salary, title: _ }),
      Employee.claim({ this: employee, name, salary }),
    ])

    const Manager = fact({
      employee: String,
      manager: String,
    })
      .with({ subordinate: Object, supervisor: Object })
      .where(({ employee, supervisor, subordinate, manager, _ }) => [
        Employee({ this: subordinate, name: employee, salary: _ }),
        Employee({ this: supervisor, name: manager, salary: _ }),
        Supervisor({ this: subordinate, supervisor }),
        Manager.claim({ employee, manager }),
      ])

    assert.deepEqual(
      new Set(await Manager().query({ from: db })),
      new Set([
        Manager.assert({
          employee: 'Hacker Alyssa P',
          manager: 'Bitdiddle Ben',
        }),
        Manager.assert({ employee: 'Fect Cy D', manager: 'Bitdiddle Ben' }),
        Manager.assert({ employee: 'Tweakit Lem E', manager: 'Bitdiddle Ben' }),
        Manager.assert({
          employee: 'Reasoner Louis',
          manager: 'Hacker Alyssa P',
        }),
        Manager.assert({
          employee: 'Bitdiddle Ben',
          manager: 'Warbucks Oliver',
        }),
        Manager.assert({
          employee: 'Scrooge Eben',
          manager: 'Warbucks Oliver',
        }),
        Manager.assert({
          employee: 'Cratchet Robert',
          manager: 'Scrooge Eben',
        }),
        Manager.assert({ employee: 'Aull DeWitt', manager: 'Warbucks Oliver' }),
      ])
    )

    assert.deepEqual(
      await Manager.match({ manager: 'Warbucks Oliver' }).query({ from: db }),
      [
        Manager.assert({
          employee: 'Scrooge Eben',
          manager: 'Warbucks Oliver',
        }),
        Manager.assert({
          employee: 'Bitdiddle Ben',
          manager: 'Warbucks Oliver',
        }),
        Manager.assert({
          employee: 'Aull DeWitt',
          manager: 'Warbucks Oliver',
        }),
      ]
    )
  },

  'test salary': async (assert) => {
    const Job = fact({ the: 'job', title: String, salary: Number })
    const Person = fact({ the: 'person', name: String })

    const Employee = fact({
      name: String,
      salary: Number,
    }).where(({ this: employee, name, salary, _ }) => [
      Person({ this: employee, name }),
      Job({ this: employee, salary, title: _ }),
      Employee.claim({ this: employee, name, salary }),
    ])

    const NonPoorEmployees = Employee.where(({ name, salary, _ }) => [
      Employee({ this: _, name, salary }),
      Data.greater({ this: salary, than: 30_000 }),
      NonPoorEmployees.claim({ name, salary }),
    ])

    assert.deepEqual(await NonPoorEmployees().query({ from: db }), [
      NonPoorEmployees.assert({ name: 'Warbucks Oliver', salary: 150_000 }),
      NonPoorEmployees.assert({ name: 'Scrooge Eben', salary: 75_000 }),
      NonPoorEmployees.assert({ name: 'Bitdiddle Ben', salary: 60_000 }),
      NonPoorEmployees.assert({ name: 'Hacker Alyssa P', salary: 40_000 }),
      NonPoorEmployees.assert({ name: 'Fect Cy D', salary: 35_000 }),
    ])

    const L2Employees = Employee.where((employee) => [
      NonPoorEmployees(employee),
      Data.less({ this: employee.salary, than: 100_000 }),
    ])

    assert.deepEqual(await L2Employees().query({ from: db }), [
      L2Employees.assert({ name: 'Scrooge Eben', salary: 75_000 }),
      L2Employees.assert({ name: 'Bitdiddle Ben', salary: 60_000 }),
      L2Employees.assert({ name: 'Hacker Alyssa P', salary: 40_000 }),
      L2Employees.assert({ name: 'Fect Cy D', salary: 35_000 }),
    ])
  },
  'test address': async (assert) => {
    const Job = fact({ the: 'job', title: String, salary: Number })
    const Person = fact({ the: 'person', name: String, address: String })

    const Employee = fact({
      name: String,
      address: String,
    }).where(({ _, ...employee }) => [
      Person(employee),
      Job({ this: employee.this, title: _, salary: _ }),
    ])

    const WhoLivesInCambridge = Employee.where((employee) => [
      Employee(employee),
      Text.includes({ this: employee.address, slice: 'Cambridge' }),
    ])

    assert.deepEqual(await WhoLivesInCambridge().query({ from: db }), [
      Employee.assert({
        this: Link.of(staff.alyssa),
        name: 'Hacker Alyssa P',
        address: 'Cambridge, Mass Ave 78',
      }),
      Employee.assert({
        this: Link.of(staff.cy),
        name: 'Fect Cy D',
        address: 'Cambridge, Ames Street 3',
      }),
    ])
  },
  'test employee with non comp supervisor ': async (assert) => {
    const Job = fact({ the: 'job', title: String })
    const Person = fact({ the: 'person', name: String })
    const Supervisor = fact({
      the: 'job',
      supervisor: Object,
    })
    const Employee = fact({
      name: String,
      job: String,
    }).where(({ _, ...employee }) => [
      Person(employee),
      Job({ this: employee.this, title: employee.job }),
    ])

    const ManagedByWheel = fact({
      employeeName: String,
      supervisorName: String,
    })
      .with({
        employee: Object,
        employeeJob: String,
        supervisor: Object,
        supervisorJob: String,
      })
      .where(
        ({
          employee,
          employeeName,
          employeeJob,
          supervisor,
          supervisorName,
          supervisorJob,
        }) => [
          Employee({ this: employee, name: employeeName, job: employeeJob }),
          Supervisor({ this: employee, supervisor }),
          Employee({
            this: supervisor,
            name: supervisorName,
            job: supervisorJob,
          }),
          Text.match({ this: employeeJob, pattern: 'Computer*' }),
          Text.not({ this: supervisorJob, pattern: 'Computer*' }),
          ManagedByWheel.claim({ employeeName, supervisorName }),
        ]
      )

    assert.deepEqual(await ManagedByWheel().query({ from: db }), [
      ManagedByWheel.assert({
        employeeName: 'Bitdiddle Ben',
        supervisorName: 'Warbucks Oliver',
      }),
    ])
  },
}
