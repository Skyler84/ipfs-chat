# IPFS Chat Web App

Browser-based peer-to-peer chat using Helia (IPFS) + libp2p PubSub.

## Current Status (Implemented)

### Core Messaging
- Real-time chat over libp2p PubSub.
- Each room maps directly to a PubSub topic string (e.g. `helia-examples/chatroom`).
- Users can:
  - Join/create rooms by topic name.
  - Switch between rooms.
  - Send and receive plain-text messages in each room.
- Messages are kept in memory per room for the current session only (no durable chat history yet).

### Connectivity Model
- No automatic room discovery via DHT/manifests yet.
- Manual peer dial is supported via multiaddr input.
- Peer connections are tracked and shown in diagnostics/member views.
- App will attempt opportunistic auto-dial when it receives a message from an unknown sender peer (rate-limited), to improve mesh connectivity.

### Identity and Persistence
- Helia/libp2p node data is persisted in IndexedDB:
  - libp2p datastore: `libp2p`
  - helia datastore: `helia`
  - blockstore: `helia-blockstore`
- This gives a stable local Peer ID across reloads, unless browser site data is cleared.
- Default chat nickname is derived from local Peer ID (e.g. `anon-xxxxxxxx`) and can be changed in UI.

### UX / App Surfaces
- Main chat interface with:
  - rooms sidebar
  - chat workspace
  - members sidebar
- Mobile drawer support (gesture + toggle based).
- Diagnostics panel:
  - subscribed topics
  - known subscribers in active topic
  - connected peer IDs
- Debug log panel for local runtime events (connect/disconnect, subscribe/publish, dial attempts).
- Additional routes:
  - `/about` for project/history metadata
  - `/settings` for local settings storage UI

### Security / Privacy (Current)
- Messaging is currently plaintext.
- No room-level auth, permissions, or access control.
- Anyone with topic knowledge + connectivity can join and read traffic.
- No end-to-end encryption or history encryption yet.

### Not Implemented Yet
- DHT-backed room/member discovery.
- Manifest-based room identity.
- Durable chat history (local or distributed).
- OrbitDB integration (history, ACLs, accounts).
- Key rotation and encrypted history flows.

---

## Planned Direction

### 1) Manifest-Defined Chatrooms
- Introduce a room manifest document as the canonical room definition.
- Room identifier format: `/<chatroom>/<manifest-cid>`.
- Manifest should hold metadata (display name, topic strategy, optional linked resources).

### 2) Discovery via DHT Provider Records
- Peers announce room membership by providing the manifest CID/multihash.
- Peers query providers for that manifest and dial discovered peers.
- This becomes the primary room join/discovery flow (instead of manual-only dialing).

### 3) Adaptive Mesh Growth
- On receiving messages from previously unknown peers, clients may dial them when local PubSub peer count is low.
- Current opportunistic auto-dial behavior can evolve into policy-driven mesh maintenance.

### 4) Manifest-Linked OrbitDB Resources (Optional per Room)
- **History DB** for chat logs.
- **Permissions DB** for ownership/ACL rules (mutable or immutable models).
- **Sub-room manifests** and cross-linking rules so sub-rooms cannot be safely reused across unrelated parent rooms.
- **DB rotation support** to cap growth and reduce blast radius of partial data loss.

### 5) Encryption + Key Lifecycle
- Support encrypted history and (optionally) encrypted live room payloads.
- Key rotation on membership changes to gate historical access for removed users.

### 6) Accounts via OrbitDB
- Portable account identity/state across devices.
- Device onboarding that grants room access without manually authenticating each libp2p node independently.

---

## Suggested Additional Features

- **Room invite payloads** (manifest CID + bootstrap peers + optional capability token).
- **Connection manager policy** (target peer counts, backoff, relay preference).
- **Message envelope versioning** (`v`, `roomId`, `sender`, `ts`, `sig`, payload type) for migration safety.
- **Signed manifests** to prevent room metadata spoofing.
- **Moderation primitives** (mute, ban list, role grants) layered on permissions DB.
- **Offline outbox + resend** for unstable connectivity.
- **Telemetry hooks** (local-only by default) for debugging mesh health and message propagation.

---

## Development

### Prerequisites
- Node.js + npm

### Run
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
```

### Test
```bash
npx playwright install
npm run test
```