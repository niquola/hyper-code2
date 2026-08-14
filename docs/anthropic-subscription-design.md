# Managed Anthropic subscription design

Status: implementation design for hyper-code2, based on `docs/anthropic-subscription-pi-mono.md`.

## Goals

Add a managed Claude Pro/Max OAuth connection without changing either existing authentication path:

- `anthropic:<model>` remains Anthropic API-key billing.
- `claude-code:<model>` remains reuse of the official Claude CLI's macOS Keychain credential.
- New `anthropic-oauth:<model>` uses credentials obtained and stored by hyper-code2.

All three use the existing Anthropic Messages streamer and canonical transcript/tool loop. Authentication source and OAuth request identity are explicit provider properties, not inferred solely from token text.

## Provider and model naming

Add provider prefix:

```text
anthropic-oauth:claude-sonnet-4-6
anthropic-oauth:claude-opus-4-6
```

Rationale:

- It is unambiguous in persisted agent rows and logs.
- It does not silently change the billing/auth semantics of `anthropic:`.
- It does not overload `claude-code:`, which specifically means external CLI credential reuse.
- It leaves room for choosing managed OAuth versus CLI reuse per agent.

`resolveEndpoint()` should return explicit auth metadata in addition to API dialect, for example:

```ts
{
  provider: "anthropic-oauth",
  api: "anthropic",
  authMode: "managed-oauth",
  claudeCodeIdentity: true,
  url: "https://api.anthropic.com/v1/messages"
}
```

Equivalent modes are `api-key`, `managed-oauth`, and `claude-cli`. `streamAnthropic()` branches on `authMode`/provider, not token prefix. Prefix detection may remain only as a defensive assertion.

## Durable credential storage

Create a dedicated table rather than putting tokens in `settings`:

```sql
CREATE TABLE oauth_credentials (
    provider       TEXT PRIMARY KEY,
    access_enc     TEXT NOT NULL,
    refresh_enc    TEXT NOT NULL,
    expires_at     BIGINT NOT NULL,
    scopes         TEXT,
    metadata       TEXT NOT NULL DEFAULT '{}',
    version        BIGINT NOT NULL DEFAULT 1,
    created_at     BIGINT NOT NULL,
    updated_at     BIGINT NOT NULL
);
```

Only `provider`, expiry, non-sensitive scopes/metadata, version, and timestamps may be returned by status APIs. Token columns are never selected by general settings/status procedures.

### Encryption at rest

Encrypt access and refresh tokens independently with AES-256-GCM using Web Crypto. Store a versioned envelope containing random 96-bit IV, ciphertext, and authentication tag. Bind ciphertext with AAD containing at least `hyper-code2/oauth-credential/v1/<provider>/<field>` so values cannot be swapped between providers or fields.

The encryption key must not live in Postgres. Resolution order:

1. `HYPER_OAUTH_ENCRYPTION_KEY` — base64url/base64 32-byte key.
2. A configured external secret reference resolved through `ctx.fns.secrets` (for example `op://...`).
3. Local-only fallback file `~/.hyper-code2/oauth.key`, generated from 32 cryptographically random bytes, parent mode `0700`, file mode `0600`.

The fallback provides pi-mono-equivalent local security while keeping database backups free of plaintext tokens. Production documentation should recommend env/1Password and stable key backup. If the key is unavailable or malformed, managed login/refresh fails closed with a generic message; existing API-key and CLI providers continue working.

Never log OAuth token responses, authorization codes, PKCE verifiers, decrypted credentials, ciphertext envelopes, or upstream response bodies that may contain them.

## Concurrent refresh

Refresh is lazy immediately before an Anthropic OAuth request. Store effective expiry five minutes before upstream expiry, as pi-mono does.

Use Postgres as the cross-process single-flight lock:

1. Open a transaction on one DB connection.
2. `SELECT ... FROM oauth_credentials WHERE provider = 'anthropic-oauth' FOR UPDATE`.
3. Re-read `expires_at` after acquiring the lock.
4. If still valid, decrypt and return the current access token.
5. If expired, decrypt the current refresh token and call the token endpoint while retaining the row lock.
6. Encrypt and atomically update the rotated access token, refresh token, effective expiry, and `version = version + 1`.
7. Commit, then return the access token.

Holding a row lock across the network request is intentional: refreshes are rare, only one provider row is blocked, and rotating refresh tokens make duplicate refresh attempts unsafe. It also works across multiple server processes. Set a fetch timeout (30 seconds) and a transaction/lock timeout where supported.

If upstream omits a rotated refresh token, preserve the previous one defensively; the expected Anthropic response includes a new token. A refresh failure does not delete credentials. Return a sanitized reconnect-required error. Do not automatically fall back from managed OAuth to the CLI credential or API key because that could silently change account/billing semantics.

## OAuth login lifecycle

Constants follow the reviewed pi-mono implementation:

- authorize: `https://claude.ai/oauth/authorize`
- token: `https://platform.claude.com/v1/oauth/token`
- client ID: `9d1c250a-e61b-44d9-88ed-5944d1962f5e`
- redirect: `http://localhost:53692/callback`
- scopes: the pi-mono Claude Code scope set

Generate independent random values for:

- PKCE verifier: 32 random bytes, base64url;
- OAuth state: 32 random bytes, base64url;
- S256 challenge: base64url(SHA-256(verifier)).

Keep pending login sessions only in server memory under `ctx.state.llm.anthropicOAuth`, keyed by state:

```ts
{
  state,
  verifier,
  redirectUri,
  createdAt,
  expiresAt,
  status: "pending" | "exchanging" | "complete" | "failed"
}
```

Reasons not to persist pending sessions:

- verifier and code are short-lived secrets;
- the localhost callback listener is process-local anyway;
- restart can safely require starting login again;
- it avoids durable replay material.

Rules:

- Ten-minute expiry.
- At most one active managed Anthropic login; starting another invalidates and closes the previous listener.
- Exact state comparison before exchange.
- State becomes single-use by atomically changing `pending -> exchanging` before network I/O.
- Remove verifier/code immediately after success or terminal failure.
- Never place verifier in URL, HTML, events, or logs. Unlike pi-mono, state is not the verifier.

## Callback and manual-code UX

### Preferred local callback

On connect:

1. Generate pending state and PKCE.
2. Attempt to bind a temporary callback listener to `127.0.0.1:53692`.
3. Redirect/open the authorization URL.
4. Callback validates path, state, error, and required code.
5. Exchange and persist credentials.
6. Return a small success page linking to hyper-code2's `/llms` page.
7. Close the temporary listener in every terminal path and on timeout.

The callback server must bind loopback only. It must reject non-GET requests, wrong paths, missing parameters, mismatched/expired state, and duplicate callbacks.

### Manual fallback

The `/llms` page displays instructions to paste either the final redirect URL or authorization code. A POST route accepts:

- full URL;
- query string containing `code` and optionally `state`;
- `code#state`;
- bare code only when exactly one unexpired pending login exists.

If supplied, state must match. The exchange always uses the fixed localhost redirect URI. The submitted code is held only in the request-local variable and never echoed back.

Manual mode is necessary when:

- port 53692 is occupied;
- hyper-code2 runs remotely but the browser's localhost is a different machine;
- the browser shows an unreachable localhost callback whose final URL can still be copied.

Errors shown in UI are sanitized categories such as `state mismatch`, `login expired`, `token exchange rejected`, or `connection unavailable`, never raw token-endpoint bodies.

## Request integration

`anthropic-oauth` should share the existing Claude subscription request behavior with `claude-code`:

- fetch a valid access token immediately before sending;
- use `Authorization: Bearer ...`, never `x-api-key`;
- include Claude Code OAuth beta headers and identity headers;
- retain the exact required top-level system identity line;
- use existing `buildLlmRequest()` and `toAnthropicMessages()`;
- preserve native tool-call IDs and result pairing.

Centralize the shared header construction so managed OAuth and CLI reuse cannot drift. Keep the existing environment overrides for OAuth endpoint/client ID only as explicit development/compatibility overrides; defaults should match the pi-mono values.

### Tool names

Do not add pi-mono's canonical casing rewrite in the first implementation. hyper-code2 wire names (`functions.read`, etc.) are custom names and are already accepted by the current `claude-code` path. Partial suffix rewriting risks making declarations, replayed history, returned calls, and registry lookup disagree.

If Anthropic rejects a specific custom name, add a separate reversible alias layer in `wireTools()` and response parsing, covered by transcript replay tests. Never mutate canonical names stored in Postgres.

## Status, connect, and logout

Extend settings/LLM connection status with:

```ts
anthropicOAuth: {
  connected: boolean,
  expiresAt: number | null,
  needsReconnect: boolean,
  loginStatus: "idle" | "pending" | "exchanging" | "failed",
  error: string | null
}
```

Status is a pure read and never refreshes. It must not expose token values, encrypted values, scopes unless deliberately approved, or upstream response bodies.

LLM UI actions:

- **Connect Claude Pro/Max**: starts/restarts managed OAuth.
- **Paste redirect/code**: manual fallback form shown while pending.
- **Reconnect**: same as connect, replacing credentials only after successful exchange; existing credentials remain usable if a new login is abandoned.
- **Disconnect**: confirmation POST that deletes only the `anthropic-oauth` credential row and clears pending login state/listener.

Logout is local deletion. Since the reviewed flow has no revocation endpoint, UI copy must say it removes credentials from hyper-code2 and does not revoke other Claude sessions. Use POST plus existing application CSRF/same-origin conventions; never implement logout as GET.

## Compatibility and precedence

The three Anthropic modes coexist:

| Agent model prefix | Credential source | Fallback |
|---|---|---|
| `anthropic:` | declared API-key secret | none |
| `claude-code:` | official CLI Keychain / current env override | none |
| `anthropic-oauth:` | encrypted Postgres credential | none |

No implicit cross-provider fallback. Existing agents retain their current model prefix and behavior. Users opt into managed OAuth by selecting an `anthropic-oauth:` model. Disconnecting managed OAuth does not alter agents; their next call fails clearly with a reconnect instruction.

The connection UI should show API-key Anthropic, Claude CLI reuse, and managed Claude Pro/Max as separate sources, even if they ultimately reach the same Messages API.

## Planned implementation units

One function per file, with names adjusted during implementation if existing conventions require:

- `src/llm/$migration_*_oauth_credentials.ts`
- `src/llm/oauthEncryptionKey.ts`
- `src/llm/encryptCredential.ts` / `decryptCredential.ts`
- `src/llm/startAnthropicOAuth.ts`
- `src/llm/completeAnthropicOAuth.ts`
- `src/llm/refreshAnthropicOAuth.ts`
- `src/llm/getAnthropicOAuthToken.ts`
- `src/llm/anthropicOAuthStatus.ts`
- `src/llm/logoutAnthropicOAuth.ts`
- connect/manual/logout HTTP routes under `src/llms/` (and loopback callback handling owned by the login procedure)
- focused OAuth, encryption, concurrency, endpoint, streamer, status, and route tests

## Acceptance criteria

- Managed OAuth can complete through localhost callback and manual paste.
- State mismatch, expiry, and callback replay are rejected.
- Credentials are encrypted in Postgres; plaintext is absent from settings, logs, events, and HTML.
- Concurrent expired-token requests produce one refresh and persist the rotated pair atomically.
- `anthropic-oauth:` sends Bearer/Claude OAuth identity requests.
- Existing `anthropic:` and `claude-code:` behavior and tests remain unchanged.
- Logout deletes only managed credentials and status immediately reports disconnected.
