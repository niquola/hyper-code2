import { readFileSync, writeFileSync } from "node:fs";

// Access tokens in ~/.kimi/credentials/kimi-code.json live ~15min.
// This procedure returns a currently-valid access_token, refreshing via the
// stored refresh_token if the access token is within 60s of expiry.
// Refreshed tokens are written back to the same file so `kimi` CLI keeps
// working too. Returns null on failure — caller should handle (no silent 401s).
const DEFAULT_OAUTH_HOST = "https://auth.kimi.com";
const CLIENT_ID = "17e5f671-d194-4dfb-9706-5516cb48c098";

export default async function (ctx: Context): Promise<string | null> {
    if (ctx.env.KIMI_CODING_API_KEY) return ctx.env.KIMI_CODING_API_KEY;
    const home = ctx.env.HOME ?? process.env.HOME ?? "";
    const path = `${home}/.kimi/credentials/kimi-code.json`;

    let creds: any;
    try { creds = JSON.parse(readFileSync(path, "utf8")); }
    catch (e: any) {
        console.warn(`[kimi-coding] cannot read ${path}: ${e?.message}`);
        return null;
    }
    const access: string | undefined = creds.access_token;
    const refresh: string | undefined = creds.refresh_token;
    if (!access || !refresh) return null;

    const now = Math.floor(Date.now() / 1000);
    const exp = decodeJwtExp(access) ?? 0;
    if (exp - now > 60) return access;

    const host = ctx.env.KIMI_CODE_OAUTH_HOST ?? DEFAULT_OAUTH_HOST;
    console.log(`[kimi-coding] access token expired ${now - exp}s ago — refreshing via ${host}`);
    const res = await fetch(`${host}/api/oauth/token`, {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded",
            "X-Msh-Platform": "hyper-code2",
            "X-Msh-Version": "0.1",
            "X-Msh-Device-Id": readDeviceId(home),
        },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: "refresh_token",
            refresh_token: refresh,
        }),
    });
    if (!res.ok) {
        console.warn(`[kimi-coding] refresh failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
        return null;
    }
    const data: any = await res.json();
    const newAccess: string | undefined = data.access_token;
    const newRefresh: string = data.refresh_token ?? refresh;
    if (!newAccess) {
        console.warn(`[kimi-coding] refresh response missing access_token: ${JSON.stringify(data).slice(0, 200)}`);
        return null;
    }
    const expiresAt = typeof data.expires_at === "number"
        ? data.expires_at
        : Math.floor(Date.now() / 1000) + (data.expires_in ?? 900);

    try {
        writeFileSync(path, JSON.stringify({
            ...creds,
            access_token: newAccess,
            refresh_token: newRefresh,
            expires_at: expiresAt,
        }, null, 2));
    } catch (e: any) {
        console.warn(`[kimi-coding] could not write refreshed creds: ${e?.message}`);
    }
    console.log(`[kimi-coding] refreshed — new access expires at ${new Date(expiresAt * 1000).toISOString()}`);
    return newAccess;
}

function readDeviceId(home: string): string {
    try { return readFileSync(`${home}/.kimi/device_id`, "utf8").trim(); }
    catch { return "hyper-code2"; }
}

function decodeJwtExp(token: string): number | null {
    try {
        const payload = token.split(".")[1];
        if (!payload) return null;
        const json = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
        return typeof json.exp === "number" ? json.exp : null;
    } catch { return null; }
}
