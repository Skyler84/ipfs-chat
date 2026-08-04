const HeliaStatusBanner = ({ colour, status, connectedPeers }) => {
  return (
    <div
      id='heliaStatus'
      className='heliaStatusBanner'
      style={{ borderColor: colour }}
    >Helia status: {status} | connected peers: {connectedPeers}
    </div>
  )
}

export default HeliaStatusBanner