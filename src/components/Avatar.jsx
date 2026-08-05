import { useMemo } from 'react'
import { shake256 } from 'js-sha3'
import { CID } from 'multiformats/cid'
import { peerIdFromString } from '@libp2p/peer-id'
import './Avatar.css'

const DEFAULT_AVATAR_SIZE = 5
const DEFAULT_BLOCK_SIZE = 0.6
const DEFAULT_GATEWAY = 'https://inbrowser.link'
const textEncoder = new TextEncoder()

export function normalizeAvatarSize(size = DEFAULT_AVATAR_SIZE) {
  const parsedSize = Number(size)

  if (!Number.isFinite(parsedSize) || parsedSize < 1) {
    return DEFAULT_AVATAR_SIZE
  }

  const roundedSize = Math.max(1, Math.round(parsedSize))
  return roundedSize % 2 === 0 ? roundedSize + 1 : roundedSize
}

export function getGateway() {
  if (typeof window === 'undefined' || window.location == null) {
    return DEFAULT_GATEWAY
  }

  const { protocol, host } = window.location
  const hostParts = host.split('.')

  if (hostParts.length >= 3 && (hostParts[1] === 'ipfs' || hostParts[1] === 'ipns')) {
    return `${protocol}//${hostParts.slice(2).join('.')}`
  }

  return DEFAULT_GATEWAY
}

export function getGatewayUrl(cid) {
  const normalizedCid = String(cid ?? '').trim()

  if (normalizedCid === '') {
    return ''
  }

  return `${getGateway()}/ipfs/${normalizedCid}`
}

export function extractMultihashBytes(value) {
  const normalizedValue = String(value ?? '').trim()

  if (normalizedValue === '') {
    return new Uint8Array()
  }

  try {
    return CID.parse(normalizedValue).multihash.bytes
  } catch {
    try {
      return peerIdFromString(normalizedValue).toMultihash().bytes
    } catch {
      return textEncoder.encode(normalizedValue)
    }
  }
}

function createSpongeBytes(seedBytes, byteLength) {
  if (byteLength <= 0) {
    return new Uint8Array()
  }

  const spongeInput = new Uint8Array(seedBytes.length + 12)
  spongeInput.set(seedBytes, 0)
  spongeInput.set(textEncoder.encode('avatar-v1'), seedBytes.length)
  const output = shake256.arrayBuffer(spongeInput, byteLength * 8)
  return new Uint8Array(output)
}

function createAvatarColor(randomBytes) {
  const hue = randomBytes[0] % 360
  const saturation = 62 + (randomBytes[1] % 18)
  const lightness = 42 + (randomBytes[2] % 14)

  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

export function createAvatarModel(seedValue, size = DEFAULT_AVATAR_SIZE) {
  const gridSize = normalizeAvatarSize(size)
  const halfWidth = Math.floor(gridSize / 2)
  const seedBytes = extractMultihashBytes(seedValue)
  const requiredBits = (gridSize * (halfWidth + 1)) + 24
  const randomBytes = createSpongeBytes(seedBytes, Math.ceil(requiredBits / 8))
  const color = createAvatarColor(randomBytes)
  const rows = []
  let hasColoredBlock = false
  let hasWhiteBlock = false
  let randomByteIndex = 3
  let randomBitMask = 0
  let randomBitValue = 0

  const nextRandomBit = () => {
    if (randomBitMask === 0) {
      randomBitValue = randomBytes[randomByteIndex] ?? 0
      randomByteIndex += 1
      randomBitMask = 0x80
    }

    const isSet = (randomBitValue & randomBitMask) !== 0
    randomBitMask >>= 1
    return isSet
  }

  for (let rowIndex = 0; rowIndex < gridSize; rowIndex += 1) {
    const row = Array.from({ length: gridSize }, () => false)

    for (let colIndex = 0; colIndex <= halfWidth; colIndex += 1) {
      const isColored = nextRandomBit()
      row[colIndex] = isColored
      row[gridSize - 1 - colIndex] = isColored

      if (isColored) {
        hasColoredBlock = true
      } else {
        hasWhiteBlock = true
      }
    }

    rows.push(row)
  }

  if (!hasColoredBlock) {
    const center = Math.floor(gridSize / 2)
    rows[center][center] = true
  }

  if (!hasWhiteBlock) {
    rows[0][0] = false
    rows[0][gridSize - 1] = false
  }

  return {
    gridSize,
    color,
    rows
  }
}

function buildClassName(...parts) {
  return parts.filter(Boolean).join(' ')
}

const Avatar = ({
  cid,
  imageCid,
  peerId,
  seed,
  size = DEFAULT_AVATAR_SIZE,
  blockSize = DEFAULT_BLOCK_SIZE,
  className = '',
  alt,
  title
}) => {
  const avatarSource = imageCid ?? cid ?? null
  const seedSource = peerId ?? seed ?? avatarSource ?? ''

  const avatarModel = useMemo(() => createAvatarModel(seedSource, size), [seedSource, size])
  const normalizedBlockSize = Number(blockSize)
  const avatarStyle = {
    '--avatar-grid-size': avatarModel.gridSize,
    '--avatar-block-size': `${Number.isFinite(normalizedBlockSize) && normalizedBlockSize > 0 ? normalizedBlockSize : DEFAULT_BLOCK_SIZE}rem`
  }

  if (avatarSource != null && String(avatarSource).trim() !== '') {
    const imageUrl = getGatewayUrl(avatarSource)

    return (
      <img
        className={buildClassName('peer-avatar', 'avatar', 'avatar-image', className)}
        src={imageUrl}
        alt={alt ?? `Avatar for ${seedSource || avatarSource}`}
        title={title ?? String(seedSource || avatarSource)}
      />
    )
  }

  return (
    <div
      className={buildClassName('peer-avatar', 'avatar', 'avatar-grid', className)}
      style={avatarStyle}
      role='img'
      aria-label={alt ?? `Avatar for ${seedSource || 'anonymous'}`}
      title={title ?? String(seedSource || 'anonymous')}
    >
      <div className='avatar-matrix' aria-hidden='true'>
        {avatarModel.rows.map((row, rowIndex) =>
          row.map((isColored, colIndex) => (
            <span
              key={`${rowIndex}-${colIndex}`}
              className={isColored ? 'avatar-block isColored' : 'avatar-block'}
              style={isColored ? { backgroundColor: avatarModel.color } : undefined}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default Avatar
