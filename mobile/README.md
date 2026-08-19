# Hyper Mobile prototype

Native SwiftUI shell around the Hyper web UI using `WKWebView`.

## Run

1. Start Hyper from the repository root: `bun start` (default `http://localhost:3010`).
2. Open `mobile/HyperMobile.xcodeproj` in Xcode.
3. Select an iPhone Simulator and press Run.

The debug default is `http://localhost:3010`. Tap the gear to change the server. For a physical iPhone use the Mac's LAN IP or an HTTPS endpoint.

The prototype deliberately permits HTTP for local development. Restrict App Transport Security before production.
