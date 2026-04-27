import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// Kicks off the kimi-coding device-authorization OAuth flow.
// Returns the user_code + verification URL the user must visit.
// Spawns a background polling task that, on success, writes the new tokens
// to ~/.kimi/credentials/kimi-code.json (same path the kimi CLI uses).
const OAUTH_HOST = "https://auth.kimi.com";
const CLIENT_ID = "17e5f671-d194-4dfb-9706-5516cb48c098";

export default async function (ctx: Context): Promise<{
    user_code: string;
    verification_uri: string;
    verification_uri_complete?: string;
    expires_in: number;
    interval: number;
}> {
    const headers = commonHeaders(ctx);
    const res = await fetch(`${OAUTH_HOST}/api/oauth/device_authorization`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: CLIENT_ID }),
    });
    if (!res.ok) throw new Error(`device_authorization ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data: any = await res.json();

    const s = (ctx.state as any).settings ?? ((ctx.state as any).settings = {});
    s.kimi = {
        deviceCode: data.device_code,
        userCode: data.user_code,
        verificationUri: data.verification_uri,
        verificationUriComplete: data.verification_uri_complete,
        interval: data.interval ?? 5,
        expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 600),
        status: "pending",
        error: null,
    };

    pollLoop(ctx).catch(e => {
        const cur = (ctx.state as any).settings?.kimi;
        if (cur) { cur.status = "failed"; cur.error = String(e?.message ?? e); }
    });

    return {
        user_code: data.user_code,
        verification_uri: data.verification_uri,
        verification_uri_complete: data.verification_uri_complete,
        expires_in: data.expires_in,
        interval: data.interval,
    };
}

async function pollLoop(ctx: Context): Promise<void> {
    const s = () => (ctx.state as any).settings.kimi;
    while (s().status === "pending") {
        const left = s().expiresAt - Math.floor(Date.now() / 1000);
        if (left <= 0) { s().status = "expired"; return; }
        await Bun.sleep((s().interval ?? 5) * 1000);
        const res = await fetch(`${OAUTH_HOST}/api/oauth/token`, {
            method: "POST",
            headers: { ...commonHeaders(ctx), "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                grant_type: "urn:ietf:params:oauth:grant-type:device_code",
                device_code: s().deviceCode,
            }),
        });
        const data: any = await res.json().catch(() => ({}));
        if (res.ok && data.access_token) {
            const home = ctx.env.HOME ?? process.env.HOME ?? "";
            const path = `${home}/.kimi/credentials/kimi-code.json`;
            mkdirSync(dirname(path), { recursive: true });
            const expiresAt = typeof data.expires_at === "number"
                ? data.expires_at
                : Math.floor(Date.now() / 1000) + (data.expires_in ?? 900);
            writeFileSync(path, JSON.stringify({
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expires_at: expiresAt,
                scope: data.scope ?? "kimi-code",
                token_type: data.token_type ?? "Bearer",
            }, null, 2));
            s().status = "logged_in";
            return;
        }
        const err = data?.error;
        if (err === "authorization_pending") continue;
        if (err === "slow_down") { s().interval = (s().interval ?? 5) + 5; continue; }
        if (err === "expired_token") { s().status = "expired"; return; }
        s().status = "failed";
        s().error = data?.error_description ?? err ?? `HTTP ${res.status}`;
        return;
    }
}

function commonHeaders(_ctx: Context): Record<string, string> {
    return {
        "X-Msh-Platform": "hyper-code2",
        "X-Msh-Version": "0.1",
        "X-Msh-Device-Id": "hyper-code2",
    };
}
