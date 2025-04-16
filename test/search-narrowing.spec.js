import { deduce, match, Inspector } from './lib.js'
import db, { arnold } from './movie.db.js'

/**
 * @type {import('entail').Suite}
 */
export const testPlan = {
  'test that search space is getting reduced': async (assert) => {
    const source = Inspector.from(db)

    const Movie = deduce({
      movie: Object,
      title: String,
      actor: Object,
    }).where(({ movie, title, actor }) => [
      match({ the: 'movie/title', of: movie, is: title }),
      match({ the: 'movie/cast', of: movie, is: actor }),
      match({ the: 'person/name', of: actor, is: 'Arnold Schwarzenegger' }),
    ])

    const result = await await Movie().query({ from: source })

    assert.deepEqual(result.length, 5)

    assert.deepEqual(
      source.queries().slice(0, 2),
      [
        { the: 'person/name', is: 'Arnold Schwarzenegger' },
        { the: 'movie/cast', is: arnold },
      ],
      'narrows search space first'
    )

    assert.equal(
      source
        .queries()
        .slice(2)
        .every(
          (selector) =>
            selector.the === 'movie/title' &&
            selector.of != null &&
            selector.is == null
        ),
      true,
      'rest queries are just lookups'
    )
  },
}
