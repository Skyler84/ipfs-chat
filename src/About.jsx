import historicalVersions from './history.json'

// Decide if this is being accessed from a local server or an IPFS web-gateway.

const DEFAULT_GATEWAY = "https://inbrowser.link"

// check if current host is CID.ipfs.xxx or CID.ipns.xxx and extract the gateway from the host if so, otherwise use the default gateway

const getGateway = () => {
    const host = window.location.host
    const parts = host.split('.')
    if (parts.length >= 3 && (parts[1] === 'ipfs' || parts[1] === 'ipns')) {
        return `${window.location.protocol}//${parts.slice(2).join('.')}`
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
                {Object.entries(historicalVersions).map(([version, info]) => (
                    <li key={version}>
                        <strong>{version.replace(/^v/, '')}</strong>: <span style={{ whiteSpace: 'pre-line' }}>{info.description}</span>{' '}
                        {info.cid ? (
                            <>(CID: <a href={getGatewayURL(info.cid)} target="_blank" rel="noopener noreferrer">{info.cid}</a>)</>
                        ) : (
                            '(CID pending)'
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default About