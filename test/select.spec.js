import * as DB from 'datalogia'
import * as Analyzer from '../src/analyzer.js'
import { assert, Fact, Data } from '../src/syntax.js'
import * as Link from '../src/link.js'
import proofsDB from './proofs.db.js'
import moviesDB from './movie.db.js'
import employeeDB from './microshaft.db.js'

/**
 * @type {import('entail').Suite}
 */
export const testSelector = {
  'nested selection': async (test) => {
    const Delegation = assert({
      this: Object,
      cid: String,
      can: Object,
      space: String,
    })
      .with({ capabilities: Object, capability: Object })
      .when(({ this: ucan, cid, capabilities, capability, space, can }) => [
        Fact({ the: 'cid', of: ucan, is: cid }),
        Fact({ the: 'capabilities', of: ucan, is: capabilities }),
        Fact({ of: capabilities, is: capability }),
        Fact({ the: 'can', of: capability, is: can }),
        Fact({ the: 'with', of: capability, is: space }),
      ])

    const Permission = assert({
      space: String,
      upload: String,
      store: String,
    }).when(({ space, upload, store }) => [
      Delegation.match({ space, can: 'upload/add', cid: upload }),
      Delegation.match({ space, can: 'store/add', cid: store }),
    ])

    const result = await Permission().select({ from: proofsDB })
    test.deepEqual(result, [
      {
        space: 'did:key:zAlice',
        upload: 'bafy...upload',
        store: 'bafy...store',
      },
    ])
  },
  'deeply nested selection': async (test) => {
    const Delegation = assert({
      this: Object,
      cid: String,
      can: Object,
      space: String,
    })
      .with({ capabilities: Object, capability: Object })
      .when(({ this: ucan, cid, capabilities, capability, space, can }) => [
        Fact({ the: 'cid', of: ucan, is: cid }),
        Fact({ the: 'capabilities', of: ucan, is: capabilities }),
        Fact({ of: capabilities, is: capability }),
        Fact({ the: 'can', of: capability, is: can }),
        Fact({ the: 'with', of: capability, is: space }),
      ])

    const Upload = Delegation.when(({ can }) => [
      Data.same({ this: 'upload/add', as: can }),
    ])

    const Store = Delegation.when(({ can }) => [
      Data.same({ this: 'store/add', as: can }),
    ])

    const Query = assert({
      upload: String,
      store: String,
      space: String,
    }).when(({ upload, store, space }) => [
      Upload.match({ space, cid: upload }),
      Store.match({ space, cid: store }),
    ])

    test.deepEqual(await Query().select({ from: proofsDB }), [
      {
        space: 'did:key:zAlice',
        upload: 'bafy...upload',
        store: 'bafy...store',
      },
    ])
  },
}
