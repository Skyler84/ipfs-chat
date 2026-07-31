// Fetch settings from local storage. If not present, redirect to the /setup/ page
try {
    const settings = JSON.parse(localStorage.getItem('settings'))
    if (!settings) throw new Error('Settings not found')
} catch (e) {
    window.location.href = '/options/options.html'
}

const ipfs = window.KuboRpcClient.create( { host: '127.0.0.1', port: 5002})