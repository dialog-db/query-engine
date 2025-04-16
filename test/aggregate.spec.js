import { Memory, $, deduce, match, Task, Link } from './lib.js'

/**
 * @type {import('entail').Suite}
 */
export const testAggregate = {
  'aggregate items': (assert) =>
    Task.spawn(function* () {
      const groceries = Link.of({ name: 'Groceries' })
      const milk = Link.of({ title: 'Buy Milk' })
      const eggs = Link.of({ title: 'Buy Eggs' })
      const bread = Link.of({ title: 'Buy Bread' })

      const chores = Link.of({ name: 'Chores' })
      const laundry = Link.of({ title: 'Do Laundry' })
      const dishes = Link.of({ title: 'Do Dishes' })

      const db = Memory.create([
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

      const Todo = deduce({
        this: Object,
        name: String,
        task: Object,
        title: String,
      })
        .where(($) => [
          match({ the: 'name', of: $.this, is: $.name }),
          match({ the: 'todo', of: $.this, is: $.task }),
          match({ the: 'title', of: $.task, is: $.title }),
        ])
        .select(({ name, task, title }) => ({
          name,
          item: [{ todo: task, title }],
        }))

      const results = yield* Todo().query({ from: db })

      assert.deepEqual(results, [
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
      const lib = Link.of({ name: 'datalogia' })
      const tags = Link.of({ tags: {} })
      const files = Link.of({ files: {} })

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

      const db = Memory.create([])
      yield* db.transact([{ Import: source }])

      const Package = deduce({
        this: Object,
        name: String,
        keywords: Object,
        keyword_at: String,
        keyword: String,
        dependencies: Object,
        dependency: String,
        dependency_version: String,
        null: { Null: {} },
        score: BigInt,
        dev: Boolean,
      })
        .where(($) => [
          match({ the: 'name', of: $.this, is: $.name }),
          match({ the: 'null', of: $.this, is: $.null }),
          match({ the: 'dependencies', of: $.this, is: $.dependencies }),
          match({
            the: $.dependency,
            of: $.dependencies,
            is: $.dependency_version,
          }),
          match({ the: 'keywords', of: $.this, is: $.keywords }),
          match({ the: $.keyword_at, of: $.keywords, is: $.keyword }),
          match({ the: 'score', of: $.this, is: $.score }),
          match({ the: 'dev', of: $.this, is: $.dev }),
        ])
        .select(
          ({
            name,
            keyword,
            keyword_at: at,
            dependency,
            dependency_version: version,
            null: nil,
            score,
            dev,
          }) => ({
            name,
            keywords: [{ at, keyword }],
            dependencies: [{ name: dependency, version }],
            null: nil,
            score,
            dev,
          })
        )

      const selection = yield* Package().query({ from: db })

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
      const db = Memory.create([])
      yield* db.transact([{ Import: { source } }])

      const Fact = deduce({
        this: Object,
        title: String,
        author: String,
        tags: Object,
        tag: String,
      })
        .where(($) => [
          match({ the: 'title', of: $.this, is: $.title }),
          match({ the: 'author', of: $.this, is: $.author }),
          match({ the: 'tags', of: $.this, is: $.tags }),
          match({ of: $.tags, is: $.tag }),
        ])
        .select(({ this: self, title, author, tags, tag }) => ({
          '/': self,
          title,
          author,
          tags: [tag],
          'tags/': tags,
        }))

      const selection = yield* Fact().query({ from: db })

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
