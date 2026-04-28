import { readFileSync, writeFileSync } from "node:fs";

// Returns a currently-valid Codex (ChatGPT) access_token.
// Re-uses ~/.codex/auth.json (the file the `codex` CLI maintains) and refreshes
// via OpenAI's OAuth /api/oauth/token + grant_type=refresh_token if the access
// token is within 60 s of expiry. The refreshed pair is written back so the
// CLI sees the updated tokens too.
const OAUTH_HOST = "https://auth.openai.com";
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"; // codex client id (from JWT aud)

export default async function (ctx: Context): Promise<string | null> {
    const home = ctx.env.HOME ?? process.env.HOME ?? "";
    const path = `${home}/.codex/auth.json`;

    let creds: any;
    try { creds = JSON.parse(readFileSync(path, "utf8")); }
    catch (e: any) {
        console.warn(`[codex] cannot read ${path}: ${e?.message}`);
        return null;
    }
    const access: string | undefined = creds?.tokens?.access_token;
    const refresh: string | undefined = creds?.tokens?.refresh_token;
    if (!access || !refresh) return null;

    const now = Math.floor(Date.now() / 1000);
    const exp = decodeJwtExp(access) ?? 0;
    if (exp - now > 60) return access;

    console.log(`[codex] access token expired ${now - exp}s ago — refreshing via ${OAUTH_HOST}`);
    const res = await fetch(`${OAUTH_HOST}/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            client_id: CLIENT_ID,
            grant_type: "refresh_token",
            refresh_token: refresh,
            scope: "openid profile email offline_access",
        }),
    });
    if (!res.ok) {
        console.warn(`[codex] refresh failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
        return null;
    }
    const data: any = await res.json();
    const newAccess: string | undefined = data.access_token ?? data.id_token;
    if (!newAccess) {
        console.warn(`[codex] refresh response missing access_token: ${JSON.stringify(data).slice(0, 200)}`);
        return null;
    }

    try {
        writeFileSync(path, JSON.stringify({
            ...creds,
            tokens: {
                ...creds.tokens,
                id_token: data.id_token ?? creds.tokens.id_token,
                access_token: newAccess,
                refresh_token: data.refresh_token ?? refresh,
            },
            last_refresh: new Date().toISOString(),
        }, null, 2));
    } catch (e: any) {
        console.warn(`[codex] could not write refreshed creds: ${e?.message}`);
    }
    console.log(`[codex] refreshed OK`);
    return newAccess;
}

function decodeJwtExp(token: string): number | null {
    try {
        const payload = token.split(".")[1];
        if (!payload) return null;
        const json = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
        return typeof json.exp === "number" ? json.exp : null;
    } catch { return null; }
}
