import { deduce, match, Data } from './lib.js'
import proofsDB from './proofs.db.js'

/**
 * @type {import('entail').Suite}
 */
export const testSelector = {
  'nested selection': async (assert) => {
    const Delegation = deduce({
      this: Object,
      cid: String,
      can: String,
      space: String,
    })
      .with({ capabilities: Object, capability: Object })
      .where(({ this: ucan, cid, capabilities, capability, space, can }) => [
        match({ the: 'cid', of: ucan, is: cid }),
        match({ the: 'capabilities', of: ucan, is: capabilities }),
        match({ of: capabilities, is: capability }),
        match({ the: 'can', of: capability, is: can }),
        match({ the: 'with', of: capability, is: space }),
      ])

    const Permission = deduce({
      space: String,
      upload: String,
      store: String,
    }).where(({ space, upload, store }) => [
      Delegation.match({ space, can: 'upload/add', cid: upload }),
      Delegation.match({ space, can: 'store/add', cid: store }),
    ])

    const result = await Permission().select({ from: proofsDB })
    assert.deepEqual(result, [
      {
        space: 'did:key:zAlice',
        upload: 'bafy...upload',
        store: 'bafy...store',
      },
    ])
  },
  'deeply nested selection': async (assert) => {
    const Delegation = deduce({
      this: Object,
      cid: String,
      can: Object,
      space: String,
    })
      .with({ capabilities: Object, capability: Object })
      .where(({ this: ucan, cid, capabilities, capability, space, can }) => [
        match({ the: 'cid', of: ucan, is: cid }),
        match({ the: 'capabilities', of: ucan, is: capabilities }),
        match({ of: capabilities, is: capability }),
        match({ the: 'can', of: capability, is: can }),
        match({ the: 'with', of: capability, is: space }),
      ])

    const Upload = Delegation.when(({ can }) => [
      Data.same({ this: 'upload/add', as: can }),
    ])

    const Store = Delegation.when(({ can }) => [
      Data.same({ this: 'store/add', as: can }),
    ])

    const Query = deduce({
      upload: String,
      store: String,
      space: String,
    }).where(({ upload, store, space }) => [
      Upload.match({ space, cid: upload }),
      Store.match({ space, cid: store }),
    ])

    assert.deepEqual(await Query().select({ from: proofsDB }), [
      {
        space: 'did:key:zAlice',
        upload: 'bafy...upload',
        store: 'bafy...store',
      },
    ])
  },
}
