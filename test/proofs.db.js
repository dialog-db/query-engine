import { Memory } from './lib.js'

export default Memory.create([
  {
    cid: 'bafy...upload',
    issuer: 'did:key:zAlice',
    audience: 'did:key:zBob',
    expiration: 1702413523,
    capabilities: [
      {
        can: 'upload/add',
        with: 'did:key:zAlice',
      },
    ],
  },
  {
    cid: 'bafy...store',
    issuer: 'did:key:zAlice',
    audience: 'did:key:zBob',
    expiration: 1702413523,
    capabilities: [
      {
        can: 'store/add',
        with: 'did:key:zAlice',
      },
      {
        can: 'store/list',
        with: 'did:key:zAlice',
      },
    ],
  },
])
