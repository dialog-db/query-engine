// @ts-nocheck
import * as DB from 'datalogia'
import { Task, Link, $ } from 'datalogia'
import { rule } from '../src/rule.js'

/**
 * @type {import('entail').Suite}
 */
export const testAggregate = {
  'skip popularProfile': async (assert) => {
    const follower = DB.link()
    const follows = DB.link()

    const operand = DB.link()
    const Same = rule({
      case: { as: $ },
    })

    const Follower = rule({
      case: { follower: follower, follows: follows },
      when: [{ Case: [follower, 'follows', follows] }],
    })

    const id = DB.link()
    const profile = DB.link()
    const c = DB.integer()
    const popularProfile = rule({
      case: { id },
      when: [
        DB.match([id, 'profile', DB._]),
        Follower.match({ follower: profile, follows: id }),
        // @ts-expect-error - we do not yet have aggregators
        Same.match({ this: c, as: count.of(profile) }),
        c.match({ '>': 3 }),
      ],
    })
  },
  'aggregate items': (assert) =>
    Task.spawn(function* () {
      const groceries = DB.Link.of({ name: 'Groceries' })
      const milk = DB.Link.of({ title: 'Buy Milk' })
      const eggs = DB.Link.of({ title: 'Buy Eggs' })
      const bread = DB.Link.of({ title: 'Buy Bread' })

      const chores = DB.Link.of({ name: 'Chores' })
      const laundry = DB.Link.of({ title: 'Do Laundry' })
      const dishes = DB.Link.of({ title: 'Do Dishes' })

      const db = DB.Memory.create([
        [groceries, 'name', 'Groceries'],
        [milk, 'title', 'Buy Milk'],
        [eggs, 'title', 'Buy Eggs'],
        [bread, 'title', 'Buy Bread'],
        [groceries, 'todo', milk],
        [groceries, 'todo', eggs],
        [groceries, 'todo', bread],
        [chores, 'name', 'Chores'],
        [laundry, 'title', 'Do Laundry'],
        [dishes, 'title', 'Do Dishes'],
        [chores, 'todo', laundry],
        [chores, 'todo', dishes],
      ])

      const list = DB.link()
      const item = DB.link()
      const title = DB.string()
      const name = DB.string()
      const todo = DB.variable()

      const match = yield* DB.query(db, {
        select: {
          name,
          item: [{ todo: item, title }],
        },
        where: [
          DB.match([list, 'name', name]),
          DB.match([list, 'todo', item]),
          DB.match([item, 'title', title]),
          // includes(todo, item),
        ],
      })

      assert.deepEqual(match, [
        {
          name: 'Groceries',
          item: [
            { todo: milk, title: 'Buy Milk' },
            { todo: eggs, title: 'Buy Eggs' },
            { todo: bread, title: 'Buy Bread' },
          ],
        },
        {
          name: 'Chores',
          item: [
            { todo: laundry, title: 'Do Laundry' },
            { todo: dishes, title: 'Do Dishes' },
          ],
        },
      ])
    }),

  'double aggregate': (assert) =>
    Task.spawn(function* () {
      const lib = DB.Link.of({ name: 'datalogia' })
      const tags = DB.Link.of({ tags: {} })
      const files = DB.Link.of({ files: {} })

      const source = {
        name: 'synopsys',
        keywords: ['datalog', 'db', 'datomic', 'graph'],
        null: null,
        dev: true,
        score: 1024n,
        dependencies: {
          '@canvas-js/okra': '0.4.5',
          '@canvas-js/okra-lmdb': '0.2.0',
          '@canvas-js/okra-memory': '0.4.5',
          '@ipld/dag-cbor': '^9.2.1',
          '@ipld/dag-json': '10.2.2',
          '@noble/hashes': '1.3.3',
          '@types/node': '22.5.5',
          datalogia: '^0.9.0',
          multiformats: '^13.3.0',
          'merkle-reference': '^0.0.3',
        },
        types: [{ './src/lib.js': './dist/lib.d.ts' }],
      }

      const db = DB.Memory.create([])
      yield* DB.transact(db, [{ Import: source }])

      const tag = DB.variable()
      const file = DB.variable()
      const title = DB.string()
      const _tags = DB.link()
      const _tagAt = DB.string()
      const _files = DB.link()
      const _filesAt = DB.string()

      // const match = yield* DB.query(db, {
      //   select: {
      //     title,
      //     tag: [tag],
      //     files: [file],
      //   },
      //   where: [
      //     DB.match([lib, 'title', title]),
      //     DB.match([lib, 'tags', _tags]),
      //     DB.match([_tags, _tagAt, tag]),
      //     DB.match([lib, 'files', _files]),
      //     DB.match([_files, _filesAt, file]),
      //   ],
      // })
      const name = DB.string()
      const at = DB.string()
      const keyword = DB.string()
      const dependency = DB.string()
      const version = DB.string()
      const entity = DB.link()
      const dependencies = DB.link()
      const keywords = DB.link()
      const score = DB.variable()
      const dev = DB.boolean()
      const nil = DB.variable()

      const selection = yield* DB.query(db, {
        select: {
          name,
          keywords: [{ at, keyword }],
          dependencies: [{ name: dependency, version }],
          null: nil,
          score,
          dev,
        },
        where: [
          { Case: [entity, 'name', name] },
          { Case: [entity, 'null', nil] },
          { Case: [entity, 'dependencies', dependencies] },
          { Case: [entity, 'keywords', keywords] },
          { Case: [keywords, at, keyword] },
          { Case: [dependencies, dependency, version] },
          { Case: [entity, 'null', nil] },
          { Case: [entity, 'score', score] },
          { Case: [entity, 'dev', dev] },
        ],
      })

      assert.deepEqual(selection, [
        {
          name: 'synopsys',
          null: null,
          score: 1024n,
          dev: true,
          keywords: [
            { at: '[0]', keyword: 'datalog' },
            { at: '[1]', keyword: 'db' },
            { at: '[2]', keyword: 'datomic' },
            { at: '[3]', keyword: 'graph' },
          ],
          dependencies: [
            { name: '@canvas-js/okra', version: '0.4.5' },
            { name: '@canvas-js/okra-lmdb', version: '0.2.0' },
            { name: '@canvas-js/okra-memory', version: '0.4.5' },
            { name: '@ipld/dag-cbor', version: '^9.2.1' },
            { name: '@ipld/dag-json', version: '10.2.2' },
            { name: '@noble/hashes', version: '1.3.3' },
            { name: '@types/node', version: '22.5.5' },
            { name: 'datalogia', version: '^0.9.0' },
            { name: 'multiformats', version: '^13.3.0' },
            { name: 'merkle-reference', version: '^0.0.3' },
          ],
        },
      ])
    }),
  'real test case': (assert) =>
    Task.spawn(function* () {
      const source = [
        {
          title: 'The Art of Programming',
          author: 'John Smith',
          tags: ['coding', 'software', 'computer science'],
        },
        {
          title: 'Digital Dreams',
          author: 'Sarah Johnson',
          tags: ['technology', 'future', 'innovation'],
        },
        {
          title: 'Cloud Atlas',
          author: 'Michael Chen',
          tags: ['cloud computing', 'infrastructure', 'devops'],
        },
        {
          title: 'Web Development Mastery',
          author: 'Emma Davis',
          tags: ['javascript', 'html', 'css', 'web'],
        },
        {
          title: 'AI Revolution',
          author: 'Robert Zhang',
          tags: ['artificial intelligence', 'machine learning', 'future'],
        },
        {
          title: 'Clean Code Principles',
          author: 'David Miller',
          tags: ['programming', 'best practices', 'software engineering'],
        },
        {
          title: 'Database Design',
          author: 'Lisa Wang',
          tags: ['sql', 'data modeling', 'databases'],
        },
        {
          title: 'Mobile First',
          author: 'James Wilson',
          tags: ['mobile development', 'responsive design', 'UX'],
        },
        {
          title: 'Security Essentials',
          author: 'Alex Thompson',
          tags: ['cybersecurity', 'networking', 'privacy'],
        },
        {
          title: 'DevOps Handbook',
          author: 'Maria Garcia',
          tags: ['devops', 'automation', 'continuous integration'],
        },
      ]
      const db = DB.Memory.create([])
      yield* DB.transact(db, [{ Import: { source } }])

      const entity = DB.link()
      const title = DB.string()
      const author = DB.string()
      const tags = DB.link()
      const tag = DB.variable()

      const selection = yield* DB.query(db, {
        select: {
          '/': entity,
          title,
          author,
          tags: [tag],
          'tags/': tags,
        },
        where: [
          {
            Case: [entity, 'title', title],
          },
          {
            Case: [entity, 'author', author],
          },
          {
            Case: [entity, 'tags', tags],
          },
          {
            Case: [tags, DB._, tag],
          },
        ],
      })

      assert.deepEqual(
        selection,
        source.map((member) => ({
          '/': Link.of(member),
          title: member.title,
          author: member.author,
          'tags/': Link.of(member.tags),
          tags: member.tags,
        }))
      )
    }),
}
