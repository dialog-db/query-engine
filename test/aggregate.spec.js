import { Memory, $, fact, Collection, Task, Link } from './lib.js'

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
        [groceries, 'list/name', 'Groceries'],
        [milk, 'todo/title', 'Buy Milk'],
        [eggs, 'todo/title', 'Buy Eggs'],
        [bread, 'todo/title', 'Buy Bread'],
        [groceries, 'list/item', milk],
        [groceries, 'list/item', eggs],
        [groceries, 'list/item', bread],
        [chores, 'list/name', 'Chores'],
        [laundry, 'todo/title', 'Do Laundry'],
        [dishes, 'todo/title', 'Do Dishes'],
        [chores, 'list/item', laundry],
        [chores, 'list/item', dishes],
      ])

      const TodoItem = fact({
        the: 'todo',
        title: String,
      })

      const TodoList = fact({
        the: 'list',
        name: String,
        item: Object,
      })

      const Todo = fact({
        name: String,
        task: Object,
        title: String,
      })
        .where(({ this: list, name, task, title }) => [
          TodoList({ this: list, name, item: task }),
          TodoItem({ this: task, title }),
        ])
        .select(({ this: list, name, task, title }) => ({
          name,
          item: [{ todo: task, title }],
        }))

      assert.deepEqual(yield* Todo().query({ from: db }), [
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
        'package/name': 'synopsys',
        'package/keywords': ['datalog', 'db', 'datomic', 'graph'],
        'package/null': null,
        'package/dev': true,
        'package/score': 1024n,
        'package/dependencies': {
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
        'package/types': [{ './src/lib.js': './dist/lib.d.ts' }],
      }

      const db = Memory.create([])
      yield* db.transact([{ Import: source }])

      const Manifest = fact({
        the: 'package',
        name: String,
        keywords: Object,
        null: null,
        dev: Boolean,
        score: BigInt,
        dependencies: Object,
        types: Object,
      })

      const Package = fact({
        the: 'package',
        name: String,
        keywords: Object,
        null: null,
        dev: Boolean,
        score: BigInt,
        dependencies: Object,
        types: Object,

        dependencyName: String,
        dependencyVersion: String,
        keywordPosition: String,
        keyword: String,
      })
        .where((manifest) => [
          Manifest(manifest),
          Collection({
            this: manifest.dependencies,
            at: manifest.dependencyName,
            of: manifest.dependencyVersion,
          }),
          Collection({
            this: manifest.keywords,
            at: manifest.keywordPosition,
            of: manifest.keyword,
          }),
        ])
        .select(
          ({
            name,
            keyword,
            keywordPosition: at,
            dependencyName: dependency,
            dependencyVersion: version,
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
          'post/title': 'The Art of Programming',
          'post/author': 'John Smith',
          'post/tags': ['coding', 'software', 'computer science'],
        },
        {
          'post/title': 'Digital Dreams',
          'post/author': 'Sarah Johnson',
          'post/tags': ['technology', 'future', 'innovation'],
        },
        {
          'post/title': 'Cloud Atlas',
          'post/author': 'Michael Chen',
          'post/tags': ['cloud computing', 'infrastructure', 'devops'],
        },
        {
          'post/title': 'Web Development Mastery',
          'post/author': 'Emma Davis',
          'post/tags': ['javascript', 'html', 'css', 'web'],
        },
        {
          'post/title': 'AI Revolution',
          'post/author': 'Robert Zhang',
          'post/tags': [
            'artificial intelligence',
            'machine learning',
            'future',
          ],
        },
        {
          'post/title': 'Clean Code Principles',
          'post/author': 'David Miller',
          'post/tags': [
            'programming',
            'best practices',
            'software engineering',
          ],
        },
        {
          'post/title': 'Database Design',
          'post/author': 'Lisa Wang',
          'post/tags': ['sql', 'data modeling', 'databases'],
        },
        {
          'post/title': 'Mobile First',
          'post/author': 'James Wilson',
          'post/tags': ['mobile development', 'responsive design', 'UX'],
        },
        {
          'post/title': 'Security Essentials',
          'post/author': 'Alex Thompson',
          'post/tags': ['cybersecurity', 'networking', 'privacy'],
        },
        {
          'post/title': 'DevOps Handbook',
          'post/author': 'Maria Garcia',
          'post/tags': ['devops', 'automation', 'continuous integration'],
        },
      ]
      const db = Memory.create([])
      yield* db.transact([{ Import: { source } }])

      const Post = fact({
        the: 'post',
        title: String,
        author: String,
        tags: Object,
      })

      const TaggedPost = fact({
        the: 'post',
        title: String,
        author: String,
        tags: Object,
        tag: String,
      })
        .where((post) => [
          Post(post),
          Collection({ this: post.tags, of: post.tag }),
        ])
        .select(({ this: post, title, author, tags, tag }) => ({
          '/': post,
          title,
          author,
          tags: [tag],
          'tags/': tags,
        }))

      const selection = yield* TaggedPost().query({ from: db })

      assert.deepEqual(
        selection,
        source.map((member) => ({
          '/': Link.of(member),
          title: member['post/title'],
          author: member['post/author'],
          'tags/': Link.of(member['post/tags']),
          tags: member['post/tags'],
        }))
      )
    }),
}
