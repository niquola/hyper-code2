# Hyper Mobile

Native SwiftUI client for Hyper. The primary experience is native: agent list, transcript, status polling, composer, send, and stop. A WebKit fallback remains available from the Safari toolbar button for pages not yet implemented natively.

## Mobile API

The app uses the versioned JSON API at `/api/mobile/v1`:

- `GET /api/mobile/v1/agents` — active agent list
- `GET /api/mobile/v1/agents/:id` — agent status and metadata
- `GET /api/mobile/v1/agents/:id/events?after=N&limit=100` — incremental transcript
- `GET /api/mobile/v1/agents/:id/events?before=N&limit=100` — older transcript page
- `POST /api/mobile/v1/agents/:id/messages` with `{ "text": "...", "debounceMs": 100 }`
- `POST /api/mobile/v1/agents/:id/stop`

The API intentionally calls existing session and agent procedures rather than duplicating queue logic.

## Run

1. Start Hyper from the repository root: `bun start` (default `http://localhost:3010`).
2. Open `mobile/HyperMobile.xcodeproj` in Xcode.
3. Select an iPhone Simulator or signed physical iPhone and press Run.

The default server is `http://localhost:3010`. On a physical iPhone, open the gear and enter the Mac's LAN address, for example `http://192.168.1.42:3010`. The Mac and iPhone must be on the same network.

The development build permits HTTP for LAN testing. Production should use HTTPS, restrict App Transport Security, and add bearer authentication before exposing Hyper outside a trusted network.
