import { record, text, integer, rule, entity, $ } from './analyzer.js'

const Person = record({
  this: {
    name: text().implicit('Untitled'),
    age: integer(),
  },
  person: {},
})

const Parent = record({
  parent: entity(),
  of: entity(),
})

const PersonRule = Person.when([
  { match: { the: 'person/name', of: Person.$, is: Person.$.name } },
  { match: { the: 'person/age', of: Person.$, is: Person.$.age } },
])

const alice = Person.assert({ name: 'Alice', age: 42 })

const ParentAndChild = record({
  child: Person,
  parent: Person,
}).derive(({ child, parent }) => [
  Person.where({ this: parent, name: parent.name, age: parent.age }),
  Person.where({ this: child, name: child.name, age: 14 }),
  Parent.where({ parent: parent, of: child }),
])
