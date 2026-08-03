import { React, useCallback, useEffect, useRef, useState } from 'react'

const historical_versions = {
    "0.4.0-a2": {
        description: "Improved peers UI, added click-to-copy text. A few nice-to-haves."
    },
    "0.4.0-a1": {
        description: "Added IndexDB datastore for libp2p and helia persistence.",
        cid: "bafybeie2msbrhlty2yl3xexrekpcdotaaj2fikegolonza6jxmdohalmtm"
    },
    "0.3.0": {
        description: "Added settings page, added WebTransport+WebRTC-Direct, tidied up app.",
        cid: "QmYPLVBbNoDQqWjY3dLRLimt7bpvhBLP2B7RwbJbg5c1s2"
    },
    "0.2.1": {
        description: "Changed BrowserRouter to HashRouter to allow for routing on IPFS web-gateways, since /about/index.html doesn't actually exist.",
        cid: "QmSKbdkpWRX4PebDaSpT1UY5KPVamPwVS18SXyjtJRquwo"
    },
    "0.2.0": {
        description: "Added react routing with an about page (this page) with historical version information.",
        cid: "QmSKbdkpWRX4PebDaSpT1UY5KPVamPwVS18SXyjtJRquwo"
    },
    "0.1.0": {
        description: "Initial release with basic chat functionality.",
        cid: "QmPPCyiB4rBJp2mSDzErmcy1PdRzNqsedJex6VMMYWzxLr"
    },
}

// Decide if this is being accessed from a local server or an IPFS web-gateway.

const DEFAULT_GATEWAY = "https://inbrowser.link"

// check if current host is CID.ipfs.xxx or CID.ipns.xxx and extract the gateway from the host if so, otherwise use the default gateway

const getGateway = () => {
    const host = window.location.host
    const parts = host.split('.')
    if (parts.length >= 3 && (parts[1] === 'ipfs' || parts[1] === 'ipns')) {
        return `${window.location.protocol}//${parts.slice(2).join('.')}:${window.location.port}`
    }
    return DEFAULT_GATEWAY
}

function getGatewayURL(cid) {
    const gateway = getGateway()
    return `${gateway}/ipfs/${cid}`
}

function About() {
    return (
        <div>
            <h1>About Page</h1>
            <h2>IPFS Helia/Libp2p chat app</h2>
            <p>Written by <a href="https://github.com/Skyler84" target="_blank" rel="noopener noreferrer">Skyler84</a></p>
            <h2>Historical Versions</h2>
            <ul>
                {Object.entries(historical_versions).map(([version, info]) => (
                    <li key={version}>
                        <strong>{version}</strong>: {info.description} (CID: <a href={getGatewayURL(info.cid)} target="_blank" rel="noopener noreferrer">{info.cid}</a>)
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default About