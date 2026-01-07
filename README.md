# Mardjan 🪸

**Mardjan** (Persian: مرجان, meaning *Coral*) is a **Zero-Knowledge, Ephemeral, P2P File Transfer** service. It allows secure file sharing between devices without storing files on a central server.

## Philosophy

- **Zero-Knowledge:** The server never sees the file content or the decryption keys.
- **Ephemeral:** No data is permanently stored.
- **P2P First:** Transfers occur directly between browsers via WebRTC.

## Architecture

Mardjan uses a **Signaling Server** (written in Go) to establish a connection between peers. Once connected, data is transferred directly using **WebRTC Data Channels**.

### Components

- **apps/web**: Next.js PWA (Frontend)
- **apps/server**: Golang Signaling Server (Backend)

## Development

### Prerequisites

- Go 1.22+
- Node.js 20+
- Docker & Docker Compose (optional)

### Getting Started

1. **Run both services (requires Make):**
   ```bash
   make dev
   ```

2. **Run manually:**

   Backend:
   ```bash
   cd apps/server
   go run cmd/server/main.go
   ```

   Frontend:
   ```bash
   cd apps/web
   npm run dev
   ```

