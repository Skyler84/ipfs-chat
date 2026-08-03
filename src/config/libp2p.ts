import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import { webTransport } from '@libp2p/webtransport'
import { gossipsub } from '@libp2p/gossipsub'
import { identify } from '@libp2p/identify'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { IDBDatastore } from 'datastore-idb'



export async function Libp2pInitOptions(defaults: any = {}) {
    
    const libp2p_datastore = new IDBDatastore('libp2p')
    await libp2p_datastore.open()

    const _Libp2pInitOptions = {
        ...defaults || {},
        addresses: {
            listen: [
                '/p2p-circuit',
                '/webrtc'
            ]
        },
        // a connection encrypter is necessary to dial the relay
        connectionEncrypters: [noise()],
        datastore: libp2p_datastore,
        // a stream muxer is necessary to dial the relay
        streamMuxers: [yamux()],
        transports: [
            webSockets(),
            webRTC(),
            webRTCDirect(),
            circuitRelayTransport(),
            webTransport(),
        ],
        services: {
            ...defaults.services || {},
            identify: identify(),
            pubsub: gossipsub(),
        },
    }
    return _Libp2pInitOptions
}
