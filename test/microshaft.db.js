import { Memory } from './lib.js'
const $ = Memory.entity

export default Memory.create([
  [$(0), 'name', 'Bitdiddle Ben'],
  [$(0), 'address', 'Slumerville, Ridge Road 10'],
  [$(0), 'job', 'Computer wizard'],
  [$(0), 'salary', 60_000],

  [$(1), 'name', 'Hacker Alyssa P'],
  [$(1), 'address', 'Campridge, Mass Ave 78'],
  [$(1), 'job', 'Computer programmer'],
  [$(1), 'salary', 40_000],
  [$(1), 'supervisor', $(0)],

  [$(2), 'name', 'Fect Cy D'],
  [$(2), 'address', 'Campridge, Ames Street 3'],
  [$(2), 'job', 'Computer programmer'],
  [$(2), 'salary', 35_000],
  [$(2), 'supervisor', $(0)],

  [$(3), 'name', 'Tweakit Lem E'],
  [$(3), 'address', 'Boston, Bay State Road 22'],
  [$(3), 'job', 'Computer technician'],
  [$(3), 'salary', 25_000],
  [$(3), 'supervisor', $(0)],

  [$(4), 'name', 'Reasoner Louis'],
  [$(4), 'address', 'Slumerville, Pine Tree Road 80'],
  [$(4), 'job', 'Computer programmer trainee'],
  [$(4), 'salary', 30_000],
  [$(4), 'supervisor', $(1)],

  [$(0), 'supervisor', $(5)],
  [$(5), 'name', 'Warbucks Oliver'],
  [$(5), 'address', 'Swellesley, Top Heap Road 1'],
  [$(5), 'job', 'Administration big wheel'],
  [$(5), 'salary', 150_000],

  [$(6), 'name', 'Scrooge Eben'],
  [$(6), 'address', 'Weston, Shady Lane 10'],
  [$(6), 'job', 'Chief accountant'],
  [$(6), 'salary', 75_000],
  [$(6), 'supervisor', $(5)],

  [$(7), 'name', 'Cratchet Robert'],
  [$(7), 'address', 'Allston, N Harvard Street 12'],
  [$(7), 'job', 'accounting scrivener'],
  [$(7), 'salary', 18_000],
  [$(7), 'supervisor', $(6)],

  [$(8), 'name', 'Aull DeWitt'],
  [$(8), 'address', 'Slumerville, Onion Square 5'],
  [$(8), 'job', 'Administration secretary'],
  [$(8), 'salary', 25_000],
  [$(8), 'supervisor', $(5)],
])
