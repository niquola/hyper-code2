# pi-mono Anthropic subscription flow — implementation notes


> Historical upstream-research snapshot. Client-version literals reflect the reviewed revision; current Hyper detects the installed Claude Code CLI through `llm.claudeCodeCliVersion`.
Source reviewed: `~/pi-mono/packages/ai/src/utils/oauth/anthropic.ts`, `pkce.ts`, `providers/anthropic.ts`, and `packages/coding-agent/src/core/auth-storage.ts`.

## OAuth constants and PKCE

- Public client ID: `9d1c250a-e61b-44d9-88ed-5944d1962f5e`.
- Authorization endpoint: `https://claude.ai/oauth/authorize`.
- Token endpoint: `https://platform.claude.com/v1/oauth/token`.
- Redirect URI: `http://localhost:53692/callback`; listener binds only `127.0.0.1:53692`.
- Requested scopes:
  `org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload`.
- PKCE generates 32 random bytes, base64url-encodes them as the verifier, then uses base64url(SHA-256(verifier)) as the S256 challenge.
- Authorization parameters are `code=true`, `client_id`, `response_type=code`, `redirect_uri`, `scope`, `code_challenge`, `code_challenge_method=S256`, and `state=verifier`.
- pi-mono uses the verifier itself as OAuth state. For hyper-code2, state and verifier should preferably be independent random values even though the upstream flow works.

## Callback and manual fallback

- A temporary localhost HTTP server validates the exact callback path, requires both `code` and `state`, rejects an OAuth `error`, and compares state before accepting the code.
- Login races the localhost callback with optional manual input. Manual input accepts:
  - a full redirect URL containing `code` and `state`;
  - a `code=...&state=...` query string;
  - `code#state`;
  - a bare code, with the expected state supplied locally.
- A manual redirect still exchanges with the fixed localhost redirect URI; tests explicitly protect this behavior.
- The callback server is always closed in `finally`.
- Implementation implication for hyper-code2: its existing HTTP server can own callback routes instead of opening port 53692, but the redirect URI must be one registered/accepted for this public client. To remain pi-compatible, a localhost callback plus manual-paste fallback is the conservative option. Pending-login state must be server-side, short-lived, single-use, and never rendered with its PKCE verifier.

## Token exchange and refresh

Authorization-code exchange is a JSON POST with a 30-second timeout:

```json
{
  "grant_type": "authorization_code",
  "client_id": "…",
  "code": "…",
  "state": "…",
  "redirect_uri": "http://localhost:53692/callback",
  "code_verifier": "…"
}
```

Refresh is also a JSON POST, but deliberately omits `scope`:

```json
{
  "grant_type": "refresh_token",
  "client_id": "…",
  "refresh_token": "…"
}
```

- Both responses are expected to include `access_token`, `refresh_token`, and `expires_in`.
- pi-mono stores an effective expiry of `Date.now() + expires_in*1000 - 5 minutes`; refresh therefore occurs with a five-minute safety margin.
- Refreshed credentials replace both access and refresh tokens. Refresh-token rotation must be persisted atomically.
- Non-2xx and malformed JSON are surfaced as errors. Raw response bodies appear in pi-mono error messages; hyper-code2 should redact them because token endpoints may echo sensitive material.

## Credential shape, storage, and locking

Canonical pi-mono OAuth credential:

```ts
{
  type: "oauth",
  access: string,
  refresh: string,
  expires: number // epoch milliseconds, already skewed early
}
```

- Credentials live under a provider key in `~/.pi/agent/auth.json`.
- Parent directory is mode `0700`; the auth file is mode `0600`.
- Every read-modify-write uses a cross-process file lock (`proper-lockfile`).
- Refresh reacquires the lock, reloads current credentials, and checks expiry again. If another process already refreshed, it reuses the new access token rather than refreshing a second time.
- Token refresh and writing the rotated pair happen while holding the same lock.
- Lookup precedence is runtime override, stored API key, stored OAuth token, environment variable, then custom fallback.
- Logout removes the provider credential locally; no upstream token revocation is performed in the reviewed flow.

Implementation implication: hyper-code2 should use Postgres as its durable store and concurrency primitive rather than copy file locking. A transaction plus row lock/advisory lock should re-read expiry, refresh once, and atomically write the rotated pair. Tokens must not be placed in normal declared settings, agent scratchpads, events, logs, or browser HTML. At-rest encryption/secret indirection should be selected during design.

## OAuth-specific Anthropic request behavior

pi-mono recognizes an Anthropic OAuth access token when it contains `sk-ant-oat` and changes request behavior:

- Authentication is Bearer (`authToken` in the SDK), not `x-api-key`.
- Base endpoint remains the Anthropic Messages API.
- Headers include:
  - `accept: application/json`
  - `anthropic-dangerous-direct-browser-access: true`
  - `anthropic-beta: claude-code-20250219,oauth-2025-04-20,fine-grained-tool-streaming-2025-05-14`
  - optional `interleaved-thinking-2025-05-14` for relevant non-adaptive models
  - `user-agent: claude-cli/2.1.75`
  - `x-app: cli`
- The system prompt must begin with an exact Claude Code identity block:
  `You are Claude Code, Anthropic's official CLI for Claude.`
- API-key Anthropic requests do not get OAuth/Claude Code identity betas or Bearer auth.

hyper-code2 already implements most of this in its `claude-code` path: Bearer auth, identity system line, token refresh from the official CLI keychain, and Claude-compatible headers. Managed OAuth should reuse that request path rather than fork transcript conversion.

## Tool-name compatibility

For OAuth calls, pi-mono maps known tool names case-insensitively to Claude Code canonical casing on the wire, including `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`, `Task`, `WebFetch`, and `WebSearch`. It applies the same mapping to:

- declared tool schemas;
- replayed historical `tool_use` blocks.

On streamed responses it maps the provider-returned name back to the caller's originally declared tool name with a case-insensitive match.

Unknown/custom tool names pass through unchanged. This bidirectional mapping prevents transcript mismatches when local wire names differ only in case. hyper-code2 currently exposes names such as `functions.read`, so blindly renaming only the familiar suffix would be unsafe. The design task must decide whether Claude subscription accepts these custom names unchanged; if normalization is added, schemas, replayed history, returned calls, and tool-result pairing must all use one reversible mapping.

## Constraints and risks to carry into design

- This is an unofficial/public-client subscription integration whose accepted endpoints, scopes, beta headers, CLI version, and identity requirements can change upstream.
- Keep managed OAuth distinct from `anthropic:` API-key auth and from existing macOS Claude CLI credential reuse, while sharing the Anthropic streamer behavior.
- Do not infer OAuth mode solely from token text in durable architecture; provider/credential type should determine it. Token-prefix detection can remain a defensive fallback.
- Refresh must be single-flight across concurrent agent runs and preferably across server processes.
- Never expose access tokens, refresh tokens, authorization codes, or PKCE verifiers through errors or UI state.
