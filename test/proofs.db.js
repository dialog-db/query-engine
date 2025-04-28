import { Memory } from './lib.js'

export default Memory.create({
  upload: {
    'ucan/cid': 'bafy...upload',
    'ucan/issuer': 'did:key:zAlice',
    'ucan/audience': 'did:key:zBob',
    'ucan/expiration': 1702413523,
    'ucan/capabilities': [
      {
        'capability/can': 'upload/add',
        'capability/with': 'did:key:zAlice',
      },
    ],
  },
  store: {
    'ucan/cid': 'bafy...store',
    'ucan/issuer': 'did:key:zAlice',
    'ucan/audience': 'did:key:zBob',
    'ucan/expiration': 1702413523,
    'ucan/capabilities': [
      {
        'capability/can': 'store/add',
        'capability/with': 'did:key:zAlice',
      },
      {
        'capability/can': 'store/list',
        'capability/with': 'did:key:zAlice',
      },
    ],
  },
})
