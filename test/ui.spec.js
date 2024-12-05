import * as DB from 'datalogia'
import { rule, Rule } from '../src/rule.js'

const $ = DB.Memory.entity

const db = DB.Memory.create([
  {
    input: '',
    items: [],
  },
])

/**
 * @type {import('entail').Suite}
 */
export const testBasic = {
  'test view': async (assert) => {
    const assign = DB.rule({
      match: { the: DB.link(), is: DB.link() },
      when: [],
    })

    const db = DB.Memory.create([
      [$(0), 'todo/draft', ''],
      [$(1), 'title', 'Hello, World!'],
      // [$(1), 'todo/list', $(0)],

      [$(2), 'title', 'Bye, World!'],
      // [$(2), 'todo/list', $(0)],
    ])

    const self = DB.link()
    const item = DB.link()
    const input = DB.string()
    const title = DB.string()

    const matches = await DB.query(db, {
      select: {
        self,
        item: { title },
        input,
      },
      where: [
        DB.match([self, 'todo/draft', input]),
        DB.match([item, 'todo/list', self]).or(
          DB.not(DB.match([item, 'todo/list', self]))
          //.and({ Is: [item, null] })
        ),
        DB.match([item, 'title', title]),
      ],
    })

    // console.log(matches)
  },
}
