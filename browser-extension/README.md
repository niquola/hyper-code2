# Hyper Sidebar — unpacked MV3 prototype

Existing Hyper `/agent/:id?presentation=sidebar` UI inside a Chrome side panel. No replacement chat, streaming client, injected content script, remote privileged script, or debugger attachment. Root directory intentionally lives beside `mobile/`.

Live native-panel, duplicate-tab isolation, iframe message/action, navigation and CDP reconnect checks passed. See [implementation and browser test report](../docs/research/browser-sidebar-live-test.md) for evidence, 61 passing tests, and remaining limitations.

## Install and pair

1. Start Hyper (default setting: `http://localhost:3010`) and its existing CDP-enabled Chrome profile. Hyper must reach **that same Chrome instance** through its configured browser CDP endpoint. No browser restart is performed by this extension.
2. In Chrome 142+, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the absolute `browser-extension/` directory. Pin the Hyper action if useful. Chrome warns about the sensitive `debugger` permission: we call only `chrome.debugger.getTargets()`, never `attach`.
3. Open extension **Details → Extension options**. Set the actual Hyper loopback HTTP origin (localhost or 127.0.0.1, any port), then **Pair with Hyper**. A regular Hyper tab opens. Sign in to ordinary Hyper if required; review the displayed extension ID and explicitly approve. Return to options and **Check approval**.
4. Open a normal source webpage and click the extension action. The first panel opening lazily binds a new ordinary agent, without running the LLM. If Chrome initially opened the default panel during installation, close and reopen it after initialization. Chrome chooses which side hosts panels; use Chrome settings to choose the right side.
5. Write in the existing Hyper composer. **Open in Hyper** opens the same agent in a full tab. Source title/domain and connection errors remain visible above the iframe. If iframe login/cookies block the page, open Hyper directly and sign in; framing/auth worked in the tested Chrome 151/152 profile with Hyper password enabled, but restrictive cookie policies may differ. Top-level login alone cannot override cookie blocking.

No build or npm dependencies. Test with:

```sh
cd browser-extension && bun test
```

## Identity and lifecycle

- `chrome.sidePanel.setOptions({tabId, path: 'panel.html?tabId=…&windowId=…&nonce=…'})` creates local, tab-specific identity. The panel never queries a global active tab to choose its agent. Distinct tabs at the same URL remain distinct.
- `chrome.debugger.getTargets()` maps exact `tabId` to exact page target ID; ambiguous/missing targets fail closed. Server validates against CDP. No URL/title fallback and no debugger attachment.
- `chrome.storage.session` holds a random browser epoch, per-tab nonce/agent/target, and pending close tombstones. These survive service worker suspension/reload, not a full browser restart. Persistent `chrome.storage.local` holds installation UUID, configured origin and bridge credential. The installation UUID is local metadata; the backend identity contract is pairing + browser epoch + tab ID.
- All mutations are serialized, backend binding is idempotent, intent is persisted before bind, and panel messages check tab/window/nonce. Context changes update the source/status without setting iframe `src` again for the same agent. Moving a tab configures its new window-specific panel path; stale instances require reopening.
- Tab close queues durable bridge close; when Hyper is offline, retry occurs on the next panel/tab activity or worker startup. Revocation is **not immediate while the server is unreachable**. No timer/alarm retry is claimed. Server-side target validation must fail closed independently. Replacement closes the old binding and assigns a fresh identity/agent, never transfers access. Same-tab unexpected target replacement is rejected, not silently retargeted.
- Browser restart creates a new epoch; old history remains in Hyper, but restoring the same tab-agent mapping across browser restart is not implemented. Extension update/reload may clear session storage, per Chrome behavior. Pending closures lost with full browser restart cannot be delivered by this prototype.
- Re-pairing first revokes the previous token/bindings and refuses to proceed if that server is unavailable. Settings can revoke explicitly. Credentials never enter iframe URLs, logs, page scripts or content scripts. Approved tokens currently expire after 30 days; pair approval after 10 minutes.

## API

See `../docs/research/browser-sidebar-contract.md`. Worker uses only JSON POST `/sidebar/api/{pair,status,bind,context,close,revoke}` with the narrow bridge bearer (except pair). Approval is a regular same-origin Hyper page. iframe authentication is Hyper's ordinary session, **not** the bridge token. `frameUrl` is deliberately reconstructed from the validated base + returned agent ID so a server response cannot point the privileged shell at another origin. UI path is `presentation=sidebar`, not legacy `embed=1`.

## Security and limitations

**Trusted-user local prototype, not an agent/tool security sandbox.** Full Hyper UI has its normal powerful capabilities and independent authentication. Chrome host permissions cannot restrict ports, so the manifest permits only HTTP localhost and 127.0.0.1 hosts, while settings pin one origin. CSP allows frames and fetch only on those loopback hosts; scripts/styles remain packaged. No `<all_urls>`, remote privileged code, external-message API, content scripts, or `web_accessible_resources`.

Unrestricted Hyper tools outside the sidebar-specific binding guard may retain ordinary trusted-user privileges. No promise of hostile-page containment, universal LLM/tool isolation, arbitrary-browser/profile support, IPv6/HTTPS loopback, or seamless restart recovery. The iframe is intentionally the real trusted Hyper UI rather than a sandboxed replacement. Cross-origin iframe load events cannot reliably diagnose login/frame blocking; use **Open in Hyper** for diagnosis.

## Manual smoke checklist

Use isolated fixture tabs in the same CDP profile. This package does not install itself or restart Chrome.

- Approve pairing; reject unapproved bridge calls. Confirm no agent exists until panel opens.
- Open panels for two tabs at the same URL; verify different agents and correct target IDs.
- Send a message through the existing composer, verify normal streaming/history/Stop.
- Navigate/reload the first tab; verify agent and iframe stay unchanged, source updates.
- Switch tabs and windows; ensure each panel retains its own identity. Move a tab and reopen its panel if stale.
- Suspend/restart the worker, reopen panel; verify session storage preserves mapping.
- Close a fixture tab; verify backend tombstone/access rejection and preserved chat history.
- Test tab replacement, unavailable CDP/server, revoked token and expired pair; errors must not silently create a different target/agent.
- Confirm the browser-plugin action guard uses the bound target rather than global `main`.

Automated tests cover pure configuration, identity, target mapping, URL construction, labels and manifest invariants; they do not prove Chrome sidePanel behavior or end-to-end server/browser guard correctness.
