import { fact, Inspector } from './lib.js'
import db, { arnold } from './movie.db.js'

/**
 * @type {import('entail').Suite}
 */
export const testPlan = {
  'test that search space is getting reduced': async (assert) => {
    const source = Inspector.from(db)
    const Movie = fact({
      the: 'movie',
      title: String,
      cast: Object,
    })

    const Person = fact({
      the: 'person',
      name: String,
    })

    const MoviesCastingArnold = Movie.with({ cast: Object }).where(
      ({ this: movie, title, cast }) => [
        Movie({ this: movie, title, cast }),
        Person({ this: cast, name: 'Arnold Schwarzenegger' }),
      ]
    )

    const result = await MoviesCastingArnold.match().query({ from: source })

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
