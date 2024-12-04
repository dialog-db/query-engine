import * as DB from 'datalogia'
import proofsDB from './proofs.db.js'

/**
 * @type {import('entail').Suite}
 */
export const testImplicit = {
  'test capabilities across ucans': async (assert) => {
    const time = 1702327123

    const ucan = DB.link()
    const space = DB.string()
    const capabilities = DB.link()
    const capability = DB.link()
    const can = DB.string()
    const expiration = DB.integer()
    const revoked = DB._

    const result = await DB.query(proofsDB, {
      select: {
        space,
        can,
      },
      where: [
        DB.match([ucan, 'capabilities', capabilities]),
        DB.match([capabilities, DB._, capability]),
        DB.match([capability, 'can', 'upload/add']),
        DB.match([capability, 'with', space]),
        DB.match([capability, 'can', can]),
        DB.not(DB.match([ucan, 'expiration', DB._])).or(
          DB.match([ucan, 'expiration', expiration]).and(
            DB.greaterOrEqual(expiration, time)
          )
        ),
      ],
    })

    assert.deepEqual(result, [
      {
        can: 'upload/add',
        space: 'did:key:zAlice',
      },
    ])
  },
}
