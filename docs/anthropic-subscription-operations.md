# Anthropic subscription operations

## Connect

1. Open `/llms` and choose **Connect Claude Pro / Max**.
2. Open the generated Anthropic authorization link and complete login within ten minutes.
3. The loopback callback normally completes automatically at `http://localhost:53692/callback`.
4. If the callback browser and hyper-code2 are on different machines, or port 53692 is unavailable, copy the final redirect URL and paste it into the manual completion form on `/llms`.

A pending login is process-local and deliberately not durable. Restarting or hot-reloading the process invalidates the old callback because its PKCE verifier is gone. Start a new login rather than retrying an old redirect URL.

## Select a model

Managed Claude Pro/Max credentials are selected explicitly with:

```text
anthropic-oauth:claude-sonnet-4-6
anthropic-oauth:claude-opus-4-6
```

The exact available model IDs remain subject to Anthropic subscription support. Existing prefixes retain separate authentication and billing semantics:

| Prefix | Credential source | Implicit fallback |
|---|---|---|
| `anthropic-oauth:` | hyper-code2 managed OAuth, encrypted in Postgres | none |
| `claude-code:` | official Claude CLI macOS Keychain credential | none |
| `anthropic:` | declared Anthropic API-key secret | none |

There is intentionally no credential precedence across these prefixes. The agent's persisted model prefix chooses one source. A managed OAuth failure never silently switches to an API key or another Claude account.

## Credential storage and encryption

Managed tokens are stored in `oauth_credentials`, encrypted independently with AES-256-GCM and provider/field-bound authenticated data. The encryption key is not stored in Postgres.

Key resolution:

1. `HYPER_OAUTH_ENCRYPTION_KEY`: base64/base64url-encoded 32-byte key.
2. Otherwise local key file `~/.hyper-code2/oauth.key`, generated with mode `0600` under a `0700` directory.
3. `HYPER_OAUTH_KEY_FILE` can override the local key path.

Back up a stable production key separately. Losing or changing it makes existing encrypted tokens unreadable and requires reconnecting. Never commit the key file.

The status/UI layer selects only connection metadata and expiry. Access tokens, refresh tokens, encrypted envelopes, authorization codes, and PKCE verifiers must not be logged, emitted as events, or rendered in HTML.

## Refresh

Access tokens refresh lazily immediately before an Anthropic request. Effective expiry is five minutes earlier than the upstream expiry.

Refresh uses a Postgres transaction and `SELECT ... FOR UPDATE`. Concurrent agent runs re-read expiry under the row lock; one request rotates and persists the token pair while later requests reuse it. Refresh failures preserve the stored credential and return a sanitized reconnect instruction.

Useful non-secret status check:

```sql
SELECT provider, expires_at, version, updated_at
FROM oauth_credentials
WHERE provider = 'anthropic-oauth';
```

Do not select token envelope columns during routine operations.

## Disconnect and revocation

**Disconnect** on `/llms` deletes only the managed `anthropic-oauth` credential and pending login state. It does not:

- revoke other Claude browser or CLI sessions;
- delete an Anthropic API key;
- delete official Claude CLI Keychain credentials;
- alter existing agents' model names.

Agents configured with `anthropic-oauth:` will fail with a reconnect instruction until managed OAuth is connected again. No upstream revocation endpoint is implemented because the reviewed pi-mono flow does not provide one. Use Anthropic account/session controls if account-wide revocation is needed.

## Callback troubleshooting

- **Login expired**: the state is absent, older than ten minutes, already used, or lost after process restart/hot reload. Start a new connection.
- **State mismatch**: do not reuse a callback from another attempt. Start again.
- **Local callback unavailable**: paste the complete final redirect URL into `/llms`; exchange still uses the fixed localhost redirect URI.
- **Refresh failed**: reconnect from `/llms`. Raw token endpoint bodies are intentionally not shown.
- **Credential cannot be decrypted**: restore the original encryption key or disconnect/reconnect.

## Required request behavior

`anthropic-oauth:` uses Anthropic Messages with Bearer authentication and Claude Code identity headers. The exact Claude Code system identity remains top-level. API-key Anthropic continues using `x-api-key` and does not receive OAuth identity headers. Canonical transcript/tool names in Postgres are not rewritten.

## Upstream-policy and compatibility risks

This integration uses an Anthropic public OAuth client and Claude Code-compatible behavior learned from pi-mono/CLI implementations. Anthropic can change or restrict any of the following without notice:

- OAuth client acceptance, authorize/token endpoints, redirect URI, or scopes;
- subscription eligibility and available model IDs;
- OAuth and Claude Code beta headers;
- required CLI user-agent/version or system identity;
- use of subscription credentials by third-party clients;
- rate limits, account enforcement, and terms of service.

Keep `ANTHROPIC_OAUTH_CLIENT_ID`, `ANTHROPIC_OAUTH_AUTHORIZE_URL`, `ANTHROPIC_OAUTH_TOKEN_URL`, `ANTHROPIC_OAUTH_REDIRECT_URI`, `CLAUDE_CODE_CLI_VERSION`, `CLAUDE_CODE_USER_AGENT`, and `CLAUDE_CODE_ANTHROPIC_BETA` overrides available for controlled compatibility updates. Review Anthropic's current terms before production deployment.

## Verification performed

- Authorization-code and refresh exchanges exercised with mocked endpoints.
- State mismatch, expiry, expiry skew, rotating refresh token, and concurrent refresh tested.
- Bearer/Claude identity request behavior and API-key isolation tested.
- Connected, pending, error, manual completion, logout, and no-secret HTML tested.
- Migration applied and live `oauth_credentials` schema inspected.
- Connect, complete, and logout routes confirmed in the live route table.
