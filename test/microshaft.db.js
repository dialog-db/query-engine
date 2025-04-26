import { Memory, fact } from './lib.js'

export const oliver = {
  'person/name': 'Warbucks Oliver',
  'person/address': 'Swellesley, Top Heap Road 1',
  'job/title': 'Administration big wheel',
  'job/salary': 150_000,
}

export const eben = {
  'person/name': 'Scrooge Eben',
  'person/address': 'Weston, Shady Lane 10',
  'job/title': 'Chief accountant',
  'job/salary': 75_000,
  'job/supervisor': oliver,
}

export const robert = {
  'person/name': 'Cratchet Robert',
  'person/address': 'Allston, N Harvard Street 12',
  'job/title': 'accounting scrivener',
  'job/salary': 18_000,
  'job/supervisor': eben,
}

export const ben = {
  'person/name': 'Bitdiddle Ben',
  'person/address': 'Slumerville, Ridge Road 10',
  'job/title': 'Computer wizard',
  'job/salary': 60_000,
  'job/supervisor': oliver,
}
export const alyssa = {
  'person/name': 'Hacker Alyssa P',
  'person/address': 'Cambridge, Mass Ave 78',
  'job/title': 'Computer programmer',
  'job/salary': 40_000,
  'job/supervisor': ben,
}
export const cy = {
  'person/name': 'Fect Cy D',
  'person/address': 'Cambridge, Ames Street 3',
  'job/title': 'Computer programmer',
  'job/salary': 35_000,
  'job/supervisor': ben,
}
export const lem = {
  'person/name': 'Tweakit Lem E',
  'person/address': 'Boston, Bay State Road 22',
  'job/title': 'Computer technician',
  'job/salary': 25_000,
  'job/supervisor': ben,
}

export const louis = {
  'person/name': 'Reasoner Louis',
  'person/address': 'Slumerville, Pine Tree Road 80',
  'job/title': 'Computer programmer trainee',
  'job/salary': 30_000,
  'job/supervisor': alyssa,
}

export const dewitt = {
  'person/name': 'Aull DeWitt',
  'person/address': 'Slumerville, Onion Square 5',
  'job/title': 'Administration secretary',
  'job/salary': 25_000,
  'job/supervisor': oliver,
}

export const staff = {
  oliver,
  eben,
  robert,
  ben,
  alyssa,
  cy,
  lem,
  louis,
  dewitt,
}

export const db = Memory.create([{ staff }])
export default db
