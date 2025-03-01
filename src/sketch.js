import {
  rule,
  fact,
  $,
  schema,
  Integer,
  Entity,
  Text,
  refer,
  where,
  query,
  text,
  integer,
  entity,
  boolean,
} from './newapi.js'
// import { $ } from "./lib.js"

const Mother = fact({
  the: 'person/mother',
  of: {},
  is: {},
})

Mother.match({ of: Entity($.actor), is: $.mother })

const Father = schema({
  of: {},
  is: {},
}).where(({ of, is }) => ({
  this: is,
  'person/father': of,
}))

const Mom = schema({
  of: {},
  is: {},
})

const MomRelation = where({
  this: Mom.is,
  'person/mother': Mom.of,
})

const TodoList = schema({
  of: {},
  title: text(),
  todo: [
    {
      title: text(),
      done: boolean(),
    },
  ],
})

TodoList.where(({ of, title, todo, _ }) => ({
  this: _,
  'todo/list': {
    this: of,
    'todo/list/name': title,
    'todo/list': {
      this: todo,
      'todo/title': todo.title,
      'todo/done': todo.done,
    },
  },
}))

const TodoListRelation = where({
  this: TodoList.of,
  'todo/list/name': TodoList.title,
  'todo/list': {
    this: TodoList.todo,
    'todo/title': TodoList.todo.title,
    'todo/done': TodoList.todo.done,
  },
})

const Name = schema({
  of: { type: 'reference' },
  is: { type: 'string' },
}).rule(({ of, is }) => ({
  match: { of, is },
  when: [{ match: { the: 'person/name', of, is } }],
}))

const Parent = schema({
  of: { type: 'reference' },
  is: { type: 'reference' },
}).rule(({ of, is }) => ({
  match: { of, is },
  when: {
    Mother: [{ match: { the: 'person/mother', of, is } }],
    Father: [{ match: { the: 'person/father', of, is } }],
  },
}))

const Ancestor = schema({
  of: {},
  is: {},
})
  .with({ parent: {} })
  .rule(({ of, is }, { parent }) => ({
    match: { of, is },
    when: [{ match: { of2: of, is }, rule: { match: Parent.match } }],
    // repeat: { of: parent, is },
    // while: [{ match: { of: parent, is }, rule: Parent }],
  }))

// const Between = schema({
//   is: { type: 'integer' },
//   from: { type: 'integer' },
//   to: { type: 'integer' },
// })
//   .with({ inc: { type: 'integer' } })
//   .rule(({ is, from, to }, { inc }) => ({
//     match: { is: from, from, to },
//     when: [{ match: { of: [is, to] }, operator: '<=' }],
//     repeat: { is, from, inc, to },
//     while: [
//       { match: { of: [from, to] }, operator: '<=' },
//       { match: { of: [from, 1], is: inc }, operator: '+' },
//       {
//         match: { text: 'test', pattern: '*', is: Text($.test) },
//         operator: 'text/like',
//       },
//     ],
//   }))

// const Test = schema({ is: integer() }).rule(({ is }) => ({
//   match: { is },
//   when: [{ match: { of: is, is: 'int32' }, operator: 'data/type' }],
// }))

// const Field = schema({
//   input: {
//     value: text(),
//     valid: boolean(),
//   },
// })
//   .with({ pattern: text() })
//   .rule(({ input: { this: input, value, valid }, _ }, { pattern }) => ({
//     match: { input },
//     when: [
//       // { match: { the: 'input/text', is: input } },
//       // { match: { the: 'text/content', value, of: input, is: value } },
//       // { match: { the: 'input/pattern', of: input, is: pattern } },
//       { match: { text: value, pattern, is2: _ }, operator: 'text/like' },
//       // { match: { is2: 1 }, rule: { match: Test.match, when: Test.when } },
//       // Test({ is: 1 }),
//       // {
//       //   // rule: { match: { is: value, the: valid } },
//       //   match: { test: 'whatever' },
//       //   rule: { match: { is: Integer($.is) } },
//       // },
//     ],
//   }))

const t = rule(
  {
    assert() {},
  },
  [{ match: { of: 5, is: 'int32' }, operator: 'data/type' }]
)

const t2 = schema({
  test: integer(),
}).rule(({ test }) => ({
  match: { test },
  when: [{ match: { of: 5, is: 32, a: 'int32' }, operator: 'data/type' }],
}))

// const Actor = rule({
//   // match: { this: $.actor1, name: $.name1 },
//   match: {},
//   when: [
//     Entity.match($.actor),
//     Text.match($.name),
//     Named.match({ of: $.actor, is: $.name }),
//     // Mother.match({ of: $.actor, is: $.mother }),
//     // { match: { the: "person/name", of: $.actor, is: $.name } },
//     // { match: { the: "movie/cast", is: $.actor } },
//   ]
// })

// const Actor = schema({
//   is: { type: 'string' },
//   of: { type: 'reference' },
// })

// // $.name.as({ type: "string" })

// Name({ of: Entity($.actor), is: Text($.name) })

// const Person = schema({
//   this: { type: 'reference' },
//   name: { type: 'string' },
//   age: { type: 'integer' },
// })

// const PersonName = fact({
//   the: 'person/name',
// })

// const PersonAge = fact({
//   the: 'person/age',
// })

// Person.assert({ this: refer('test'), name: 'Irakli', age: 40 })

// const PersonRule = rule(Person, [
//   PersonName({ of: Person.this, is: Person.name }),
//   PersonAge({ of: Person.this, is: Person.age }),
// ])

// const test = rule({
//   match: { of: $.person, name: $.name, age: $.age },
//   when: [
//     { match: { the: 'person/name', of: Entity($.person), is: $.name } },
//     { match: { of: $.person, is: $.name }, rule: PersonRule },
//     // PersonName({ of: $.person, is: $.name }),
//     // PersonAge({ of: $.person, is: $.age }),
//   ],
// })

// const Parent = schema({
//   of: { type: 'reference' },
//   is: { type: 'reference' },
// })

// const Ancestor = schema({
//   of: { type: 'reference' },
//   is: { type: 'reference' },
//   // }).when(({ of, is }) => ({
//   //   Parent: [Parent.match({ of, is })],
//   //   Ancestor: [
//   //     Parent.match({ of, is: $.parent }),

//   //     // $.parent
//   //   //   Self.match({ of: $.parent, is }),
//   //   // ]
//   // }))
// })

// const AncestorRule = Ancestor.rule(({ is: ancestor, of: child }) => [
//   Parent({ of: child, is: ancestor }),
// ])
//   .loop({ parent: { type: 'reference' } })
//   .while(({ is: ancestor, of: child, parent }) => [
//     Parent({ of: child, is: parent }),
//     Ancestor({ of: parent, is: ancestor }),
//   ])
// // .with(() => Entity.match($.parent))
// // .with(() => Entity.match($.child))
// // .with(() => [
// //   Parent.match({ of: $.child, is: $.parent }),
// //   // Ancestor.match({ of: $.parent, is: $.ancestor })
// // ])
// // .while(({ parent, is: ancestor, of: child }) => [
// //   Parent.match({ of: child, is: parent }),
// //   Ancestor.match({ of: parent, is: ancestor })
// // ])

// function* when() {
//   const a = Entity.match($.ancestor)
//   const b = Entity.match($.child)

//   yield Parent({ of: $.child, is: $.ancestor })
// }

// const Parent = schema({
//   is: { type: "reference" },
//   of: { type: "reference" },
// })

// .loop(({ of, is: parent }) => [
//   Parent.match({ of, is: parent }),
//   { of: parent, is }
//   Ancestor.match({ of: parent, is })
// ])

// Person.match({ this: $.actor, name: "Arnold" })

// const of = $.child.entity()
// const out = Parent.rule({ of: $.child.entity(), is: $.ancestor.entity() })

// const Name = schema({
//   is: { type: "string" },
//   of: { type: "reference" },
// })

// const t = Name.rule({ is: "Arnold", of: $.actor })

// $.actor

// asString($.name)
// $.name

// const Point = schema({
//   x: { type: "integer" },
//   y: { type: "integer" },
// })

// Integer.match($.x)
// Integer.match($.y)
// Point.rule({ x: $.x, y: $.y })

// $.actor
// const Test = rule({
//   match: { this: $.actor, name: $.actorName },
//   when: [
//     {
//       this: $.movie,
//       "movie/cast": {

//         this: $.actor,
//         "person/name": $.actorName,
//         "person/age": $.age
//       }
//     },

//     {
//       this: $.todo,
//       "todo/task": {
//         [$.at.id]: {
//           this: $.task,
//           done: $.done,
//           title: $.title
//         }
//       },
//     },
//     { the: "actor/name", of: $.actor, is: $.actorName },
//     { the: $.sky, where: "color", is: $.blue },
//     { the: $.movie, where: "cast/actor", is: $.arnold},

//     [{fact:{}}, { the: "actor/name", of: $.actor, is: $.actorName }],
//     [{rule:{}}, { age: $.age, of: $.actor }],
//     [Parent, { of: $.child, is: $.ancestor }],

//     { match: { the: "child/parent", of: $.child, is: $.ancestor } },

//     { match: { the: "actor/name", of: $.actor, as: $.actorName }, fact: { from: $.db } },
//     { match: { text: $.actorName, pattern: "Arnold*" }, operator: "text/like" },
//     { match: { the: "actor/name", of: $.actor, is: $.actorName } },
//     { match: { the: "child/parent", is: $.parent, of: $.child }, rule: Parent },
//     { match: { the: $.parent, of: $.child }, from: { the: "child/parent" } },
//     { match: { the: $.todo, at: $.index }, in: $.list },
//     // { select: { this: $.movie, 'movie/cast': $.actor } },
//     // { select: { this: $.actor, 'person/name': $.actorName } },
//     {
//       match: { text: $.actorName, pattern: "Arnold*"},
//       formula: "text/like"
//     }
//   ]
// })

// const arnold = Actor({
//   this: $.actor,
//   name: 'Arnold'
// })

// arnold.when
// arnold.input
// arnold.op
// Actor.cells.name.read

// formula({
//   match: {
//     x: $.myX,
//     y: $.myY,
//     // this: $.out
//   },
//   operator: {
//     /**
//      * @param {object} input
//      * @param {number} input.x
//      * @param {number} input.y
//      * @returns
//      */
//     formula: ({x, y}) => [x + y],
//     input: {
//       x: $.x,
//       y: $.y
//     },
//     output: {
//       this: $.this
//     }
//   }
// })

// when([
//   // { select: { this: $.actor, 'person/name': $.name } },
//   // { match: [0, 1], operator: "<" },
//   // {
//   //   match: { this: $.ancestor, of: $.actor },
//   //   rule: {
//   //     match: { this: $.ancestor, of: $.child },
//   //     when: [
//   //       { select: { this: $.child, 'person/parent': $.ancestor } }
//   //     ],
//   //     repeat: { this: $.ancestor, of: $.parent },
//   //     while: [
//   //       { select: { this: $.parent, 'person/parent': $.ancestor } }
//   //     ]
//   //   }
//   // },
//   {
//     match: {
//       // this: $.out, x: $.x, y: $.y
//     } ,
//     operator: {
//       // input: { x: $.x, y: $.y },
//       // output: $.this,
//       /**
//        * @param {object} input
//        * @param {number} input.x
//        * @param {number} input.y
//       */
//      formula: ({x, y}) => [x + y],
//      input: {},
//      output: $.this
//     }
//   }
// ])

// const TodoList = Join("todo/list")

// const TodoList = property({
//   the: "todo/list",
//   of: Schema.entity(),
//   is: Schema.entity(),
// })

// const query = {
//   this: $.actor,
//   todo: {
//     this: {
//       is: $.todo,
//       when: [{ title: { in: ["Groceries", "Chores"] } }],
//     },
//     items: [{
//       this: {
//         is: $.todo,
//         limit: 10,
//         offset: 100,
//         when: [
//           { archived: { not: true } },
//           { author: { like: "*@gozala.io" } }
//         ]
//       },
//       title: $.title,
//       done: $.done
//     }]
//   }
// }

// rule({
//   match: {},
//   when: [
//     // TodoList({ this: $.list, of: $.collection }),
//     {
//       select: { this: $.db, ['todo/list']: $.list },
//       from: $.db,
//     },

//     // Actor({ this: $.actor, name: $.name }),
//     {
//       match: { this: $.actor, name: $.name },
//       rule: Actor
//     },

//     {
//       match: { this: $.inc, from: $.name },
//       operator: {
//         formula: (n) => n + 1,
//         input: $.from,
//         out: $.this,
//       }
//     },

//     {
//       match: { text: $.text, like: "*@gozala.io" },
//       operator: "text/like"
//     }

//     // Actor({ name: $.name }),
//     [{ match: Actor }, { name: $.name }],
//     // Collect all the variables
//     [{ for: "click/count" }, { to: $.count, from: $.list }],

//     // Last write wins
//     [{ the: "click/count" }, { the: $.lastCount, of: $.list }],

//     // maps $.count to $.inc
//     [{ derive: (x) => x + 1 }, { from: $.count, this: $.inc }],
//     [(x) => x + 1, $.count, $.inc],

//     [{ the: "cursor/position" }, { this: $.position, of: $ }],
//     Point({ this: $.position, x: $.x, y: $.y }),

//     // destructuring the record
//     [{ do: CBOR.decode }, { with: $.position, this: { x: $.x, y: $.y, meta: $.meta } }],
//     [{ do: CBOR.decode }, { with: $.meta, this: { v: $.v } }],

//     Point({ this: $.position, x: $.x, y: $.y, meta: { v: $.v } }),

//     // Iterate over the collection of elements
//     [{ iterate: $.list }, { this: $.todo, at: $.index }],
//   ]
// })

// const Elements = Collection()

// [
//   [{ for: $.at }, { some: $.element, of: $.collection }],
// ]

// assert({ x: 0, y: 0, meta: { v: 1 } })

// [db, refer({ x: 0, y: 0, meta: refer({ v: 1 }) }), CBOR.encode({ x: 0, y: 0, meta: refer({ v: 1 }) })]
// [db, refer({ v: 1 }), CBOR.encode({ v: 1 })]

// [db, refer({ v: 1 }), CBOR.encode({ v: 2 })]

// assert({ hello: "world", meta: { v: 1 } })

// { x, y, meta: refer({ v: 1 }) }

// { x, y, meta: { v: 2 } }

// [db, refer({ v: 2 }), { v: 1 }]
