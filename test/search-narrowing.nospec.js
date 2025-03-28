import * as DB from 'datalogia'
import Movies from './movie.db.js'

class ScanInspector {
  /**
   *
   * @param {DB.Querier} source
   */
  constructor(source) {
    this.source = source
    /** @type {DB.FactsSelector[]} */
    this.scans = []
  }
  /**
   *
   * @param {DB.FactsSelector} pattern
   */
  scan(pattern) {
    this.scans.push(pattern)
    return this.source.scan(pattern)
  }
}

/**
 * @type {import('entail').Suite}
 */
export const testPlan = {
  'test that search space is getting reduced': async (assert) => {
    const movies = new ScanInspector(Movies)

    const $ = {
      movie: DB.link(),
      title: DB.variable(),
      actor: DB.link(),
    }

    const result = await await DB.query(movies, {
      select: {
        title: $.title,
        actor: $.actor,
      },
      where: [
        { Case: [$.movie, 'movie/title', $.title] },
        { Case: [$.movie, 'movie/cast', $.actor] },
        { Case: [$.actor, 'person/name', 'Arnold Schwarzenegger'] },
      ],
    })

    assert.deepEqual(result.length, 5)
    const [{ actor }] = result
    assert.deepEqual(movies.scans.slice(0, 1), [
      {
        entity: undefined,
        attribute: 'person/name',
        value: 'Arnold Schwarzenegger',
      },
      // {
      //   entity: undefined,
      //   attribute: 'movie/cast',
      //   value: actor,
      // },
    ])
  },
}
