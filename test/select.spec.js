import { fact, same, Collection } from './lib.js'
import proofsDB from './proofs.db.js'

const UCAN = fact({
  the: 'ucan',
  cid: String,
  issuer: String,
  audience: String,
  capabilities: Object,
})

const Capability = fact({
  the: 'capability',
  can: String,
  with: String,
})

/**
 * @type {import('entail').Suite}
 */
export const testSelector = {
  'nested selection': async (assert) => {
    const Delegation = fact({
      this: Object,
      cid: String,
      can: String,
      subject: String,
    })
      .with({ capabilities: Object, capability: Object })
      .where(
        ({ this: ucan, cid, capabilities, capability, subject, can, _ }) => [
          UCAN.match({ this: ucan, cid, capabilities }),
          Collection({ this: capabilities, of: capability }),
          Capability({ this: capability, can, with: subject }),
          Delegation.claim({ this: ucan, cid, can, subject }),
        ]
      )

    const Permission = fact({
      space: String,
      upload: String,
      store: String,
    }).where(({ space, upload, store }) => [
      Delegation.match({ subject: space, can: 'upload/add', cid: upload }),
      Delegation.match({ subject: space, can: 'store/add', cid: store }),
      Permission.claim({ space, upload, store }),
    ])

    const result = await Permission().query({ from: proofsDB })
    assert.deepEqual(result, [
      Permission.assert({
        space: 'did:key:zAlice',
        upload: 'bafy...upload',
        store: 'bafy...store',
      }),
    ])
  },
  'deeply nested selection': async (assert) => {
    const Delegation = fact({
      this: Object,
      cid: String,
      can: String,
      subject: String,
    })
      .with({ capabilities: Object, capability: Object })
      .where(
        ({ this: ucan, cid, capabilities, capability, subject, can, _ }) => [
          UCAN.match({ this: ucan, cid, capabilities }),
          Collection({ this: capabilities, of: capability }),
          Capability({ this: capability, can, with: subject }),
          Delegation.claim({ this: ucan, cid, can, subject }),
        ]
      )

    const Upload = Delegation.where((delegation) => [
      Delegation(delegation),
      same({ this: delegation.can, as: 'upload/add' }),
    ])

    const Store = Delegation.where((delegation) => [
      Delegation(delegation),
      same({ this: delegation.can, as: 'store/add' }),
    ])

    const Permission = fact({
      upload: String,
      store: String,
      space: String,
    }).where(({ upload, store, space }) => [
      Upload.match({ subject: space, cid: upload }),
      Store.match({ subject: space, cid: store }),
      Permission.claim({ space, store, upload }),
    ])

    assert.deepEqual(await Permission().query({ from: proofsDB }), [
      Permission.assert({
        space: 'did:key:zAlice',
        upload: 'bafy...upload',
        store: 'bafy...store',
      }),
    ])
  },
}
