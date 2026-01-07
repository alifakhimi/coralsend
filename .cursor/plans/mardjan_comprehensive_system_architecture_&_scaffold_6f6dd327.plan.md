---
name: Mardjan Comprehensive System Architecture & Scaffold
overview: Establish the complete architecture and monorepo structure for 'Mardjan'. This plan details the Secure P2P architecture, Signaling Protocol, Security Model, and the implementation roadmap for the MVP using Golang (Signaling) and Next.js (PWA/WebRTC).
todos:
  - id: scaffold-monorepo
    content: Create Monorepo structure and initialize Go module and Next.js app
    status: completed
  - id: impl-signal-server
    content: Implement basic Golang WebSocket Signaling Server (Hub & Room logic)
    status: completed
    dependencies:
      - scaffold-monorepo
  - id: impl-frontend-webrtc
    content: Implement Frontend WebRTC Hook and connection logic
    status: completed
    dependencies:
      - impl-signal-server
  - id: impl-ui-basic
    content: Implement UI for Send/Receive and QR Code generation/scanning
    status: completed
    dependencies:
      - impl-frontend-webrtc
  - id: impl-file-transfer
    content: Implement File Chunking and Transfer logic
    status: completed
    dependencies:
      - impl-ui-basic
---

# Mardjan System Architecture & Implementation Plan

## 1. System Philosophy (The "Coral" Concept)

Mardjan is a **Zero-Knowledge, Ephemeral, P2P File Transfer** service.

- **Zero-Knowledge:** The server (Relay/Signaling) never sees the file content or the decryption keys.
- **Ephemeral:** No data is permanently stored on the server.
- **P2P First:** Transfers occur directly between browsers via WebRTC.

## 2. Technical Architecture

### A. High-Level Data Flow

```mermaid
sequenceDiagram
    participant A as Alice (Sender)
    participant S as Signal Server (Go)
    participant B as Bob (Receiver)

    Note over A: 1. Generate RoomID & Key
    A->>S: WS Connect (Join RoomID)
    Note over A: 2. Share Link/QR (RoomID + Key)
    
    Note over B: 3. Scan QR / Click Link
    B->>S: WS Connect (Join RoomID)
    S->>A: Peer Joined Event
    
    Note over A,B: 4. WebRTC Handshake (SDP Offer/Answer via Server)
    
    A->>B: P2P Data Channel Open
    A->>B: Send Metadata (Encrypted with Key)
    B->>A: Accept Transfer
    
    Note over A,B: 5. File Transfer (Chunked, Encrypted, P2P)
    Note over B: 6. Blob Assembly & Download
```



### B. Component Stack

#### 1. Frontend (apps/web)

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **P2P Logic:** `simple-peer` (WebRTC wrapper) or raw `RTCPeerConnection`
- **Crypto:** `Web Crypto API` (Native browser AES-GCM)
- **State:** `Zustand` (for managing connection state)
- **UI:** Tailwind CSS + Radix UI (Minimalist design)
- **PWA:** `next-pwa` (Service Workers, Manifest)

#### 2. Backend (apps/server)

- **Language:** Golang 1.22+
- **Protocol:** WebSocket (using `github.com/gorilla/websocket` or `nhooyr.io/websocket`)
- **Role:** Pure Signaling. No database required for MVP (in-memory room maps).
- **Discovery:** Implements a lightweight room-based messaging system.

## 3. Security Design (Zero-Trust)

- **RoomID:** A random UUIDv4 used to route signaling messages. Known to the server.
- **Shared Key (PSK):** A random string generated on Client A. **Never sent to the server.** It is encoded in the URL hash (`#key=...`) or embedded in the QR code.
- **Encryption:**
- **Signaling:** TLS (HTTPS/WSS).
- **Metadata:** Encrypted with PSK before sending over P2P (even though P2P is encrypted, we add layer 2 security).
- **File Data:** WebRTC uses DTLS/SRTP by default (encryption in transit).

## 4. Implementation Phases (MVP)

### Phase 1: Foundation (Scaffold)

- Set up Monorepo structure (`apps/web`, `apps/server`).
- Configure Docker Compose for local dev.
- Create shared types (if possible via JSON schema or manual sync).

### Phase 2: Signaling Server

- Implement Websocket Handler in Go.
- Create `RoomManager` to handle Join/Leave/Message events.
- Define Signaling Protocol (JSON messages: `offer`, `answer`, `candidate`).

### Phase 3: Frontend P2P Core

- implement `useWebRTC` hook.
- Integrate `qrcode.react` for generating connection codes.
- Implement `html5-qrcode` for scanning.
- Basic UI for "Send" (Create Room) and "Receive" (Join Room).

### Phase 4: File Transfer Logic

- Implement File Chunking (to handle large files without crashing memory).
- Implement Progress Bar logic.
- Add "Download" blob handling.

### Phase 5: Polish & PWA

- Add Service Worker for offline capability (app shell).
- Add "Install App" prompt.
- Mobile responsiveness improvements.

## 5. Directory Structure Target

```text
mardjan/
├── apps/
│   ├── web/                 # Next.js
│   │   ├── src/
│   │   │   ├── components/  # UI Components
│   │   │   ├── hooks/       # useWebRTC, useSignaling
│   │   │   ├── lib/         # crypto.ts, p2p.ts
│   │   │   └── app/         # Pages (Send/Receive)
│   │   └── public/
│   │
│   └── server/              # Golang
│       ├── cmd/server/      # main.go
│       └── internal/
│           ├── signal/      # Hub & Client logic
│           └── protocol/    # Message structs
│
├── deploy/                  # Docker configs
├── Makefile                 # Dev commands
└── README.md




```