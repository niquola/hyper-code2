# Password authentication

Hyper can require one shared password before exposing the UI and `/api/mobile/v1` through an HTTPS tunnel. Authentication is disabled when no password is configured, preserving local development behavior.

## Configure

Prefer a Bun Argon2 password hash instead of storing plaintext:

```bash
bun -e 'console.log(await Bun.password.hash(process.argv[1]))' 'your-long-password'
```

Set the resulting hash as the secret setting `auth.password` in Hyper Settings, or provide it through:

```bash
HYPER_PASSWORD='$argon2id$...'
```

Plain values are accepted for initial development but are not recommended. Restart or reload the `auth` namespace after changing environment configuration.

## Tunnel

Terminate TLS at the tunnel and forward to `http://127.0.0.1:3010`. The tunnel must send `X-Forwarded-Proto: https`; Hyper then issues a `Secure`, `HttpOnly`, `SameSite=Lax` signed session cookie. Do not expose port 3010 directly to the internet.

Browser requests redirect to `/auth/login`. JSON/mobile requests receive HTTP 401. The native iPhone app displays its password screen and stores the resulting cookie in the shared `URLSession` cookie store.

## Security scope

This is intentionally basic single-user authentication. It provides password verification, signed expiring sessions, secure cookie flags behind HTTPS, no-store auth responses, open-redirect prevention, and origin checks for browser writes. It does not yet provide users, password reset, rate limiting across processes, MFA, revocation of already issued sessions, or fine-grained authorization. Changing the signing key or waiting for expiry invalidates sessions; default session lifetime is 30 days.
