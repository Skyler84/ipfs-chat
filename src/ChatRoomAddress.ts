import { CID } from 'multiformats/cid'
import * as Block from 'multiformats/block'
import { base58btc } from 'multiformats/bases/base58'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'

export const CHATROOM_PROTOCOL = 'ipfs-chat'
export const CHATROOM_PREFIX = `/${CHATROOM_PROTOCOL}`

const encoder = new TextEncoder()

const isRoomAddressString = (value: unknown): value is string => {
  return typeof value === 'string' && value.startsWith(`${CHATROOM_PREFIX}/`)
}

const createManifestCidFromRoomName = async (roomName: string) => {
  // Current chatroom addresses are derived from the plaintext public room
  // name. This follows OrbitDB's manifest creation pattern, but uses the raw
  // codec for public chatrooms until a dedicated manifest document exists.
  const { cid } = await Block.encode({
    value: encoder.encode(roomName),
    codec: raw,
    hasher: sha256
  })

  return cid
}

const parseRoomAddress = (address: string) => {
  const normalizedAddress = address.trim()

  if (!normalizedAddress.startsWith(`${CHATROOM_PREFIX}/`)) {
    throw new Error(`Not a valid ChatRoom address: ${address}`)
  }

  const hash = normalizedAddress
    .replace(`${CHATROOM_PREFIX}/`, '')
    .replaceAll('/', '')
    .replaceAll('\\', '')

  if (hash === '') {
    throw new Error(`Not a valid ChatRoom address: ${address}`)
  }

  let cid

  try {
    cid = CID.parse(hash)
  } catch {
    throw new Error(`Not a valid ChatRoom address: ${address}`)
  }

  return new ChatRoomAddress({
    protocol: CHATROOM_PROTOCOL,
    hash: cid.toString(base58btc),
    address: normalizedAddress,
    cid
  })
}

export class ChatRoomAddress {
  protocol

  hash

  address

  cid

  roomName

  constructor ({ protocol, hash, address, cid, roomName = null }) {
    this.protocol = protocol
    this.hash = hash
    this.address = address
    this.cid = cid
    this.roomName = roomName
  }

  static isValid (value) {
    if (value instanceof ChatRoomAddress || value instanceof CID) {
      return true
    }

    if (typeof value !== 'string') {
      return false
    }

    const trimmedValue = value.trim()

    if (trimmedValue === '') {
      return false
    }

    if (isRoomAddressString(trimmedValue)) {
      try {
        parseRoomAddress(trimmedValue)
        return true
      } catch {
        return false
      }
    }

    return true
  }

  static async parse (value) {
    if (value instanceof ChatRoomAddress) {
      return value
    }

    if (value instanceof CID) {
      // TODO: once chatroom manifests become first-class documents, accept the
      // manifest CID directly as the room identifier source of truth.
      return new ChatRoomAddress({
        protocol: CHATROOM_PROTOCOL,
        hash: value.toString(base58btc),
        address: `${CHATROOM_PREFIX}/${value.toString(base58btc)}`,
        cid: value
      })
    }

    if (isRoomAddressString(value)) {
      return parseRoomAddress(value)
    }

    if (typeof value === 'string') {
      const roomName = value.trim()

      if (roomName === '') {
        throw new Error(`Not a valid ChatRoom address: ${value}`)
      }

      const cid = await createManifestCidFromRoomName(roomName)

      return new ChatRoomAddress({
        protocol: CHATROOM_PROTOCOL,
        hash: cid.toString(base58btc),
        address: `${CHATROOM_PREFIX}/${cid.toString(base58btc)}`,
        cid,
        roomName
      })
    }

    throw new Error(`Not a valid ChatRoom address: ${String(value)}`)
  }

  static async fromRoomName (roomName) {
    return ChatRoomAddress.parse(roomName)
  }

  static fromManifestCid (cid) {
    // TODO: swap callers to this path once manifests are created separately
    // from public chatroom names.
    return ChatRoomAddress.parse(cid)
  }

  toString () {
    return this.address
  }
}

export const isValidChatRoomAddress = (value) => ChatRoomAddress.isValid(value)

export const parseChatRoomAddress = (value) => ChatRoomAddress.parse(value)

export const chatRoomAddressFromRoomName = (roomName) => ChatRoomAddress.fromRoomName(roomName)

export const chatRoomAddressFromManifestCid = (cid) => ChatRoomAddress.fromManifestCid(cid)

export default ChatRoomAddress
