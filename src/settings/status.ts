// Snapshot of which providers are currently authenticated.
// Pure read — never refreshes a token. Used by the settings page.
import { readFileSync } from "node:fs";

export default function (ctx: Context): {
    openai: { set: boolean };
    anthropic: { set: boolean };
    kimi: { set: boolean };
    groq: { set: boolean };
    openrouter: { set: boolean };
    kimiCoding: { loggedIn: boolean; expSec: number | null; loginPending: boolean };
    codex: { loggedIn: boolean; email: string | null; expSec: number | null; loginPending: boolean };
} {
    const env = ctx.env;
    const home = env.HOME ?? process.env.HOME ?? "";

    let kc: { loggedIn: boolean; expSec: number | null } = { loggedIn: false, expSec: null };
    try {
        const j = JSON.parse(readFileSync(`${home}/.kimi/credentials/kimi-code.json`, "utf8"));
        const exp = decodeJwtExp(j.access_token);
        kc = { loggedIn: !!j.access_token, expSec: exp };
    } catch { /* not logged in */ }
    const kimiPending = (ctx.state as any).settings?.kimi?.status === "pending";

    let cx: { loggedIn: boolean; email: string | null; expSec: number | null } = { loggedIn: false, email: null, expSec: null };
    try {
        const j = JSON.parse(readFileSync(`${home}/.codex/auth.json`, "utf8"));
        const tok = j.tokens?.access_token;
        if (tok) {
            const payload = decodeJwtPayload(tok);
            cx = {
                loggedIn: true,
                email: payload?.["https://api.openai.com/profile"]?.email ?? null,
                expSec: typeof payload?.exp === "number" ? payload.exp : null,
            };
        }
    } catch { /* not logged in */ }
    const codexPending = (ctx.state as any).settings?.codex?.status === "pending";

    return {
        openai: { set: !!env.OPENAI_API_KEY },
        anthropic: { set: !!env.ANTHROPIC_API_KEY },
        kimi: { set: !!env.KIMI_API_KEY },
        groq: { set: !!env.GROQ_API_KEY },
        openrouter: { set: !!env.OPENROUTER_API_KEY },
        kimiCoding: { ...kc, loginPending: kimiPending },
        codex: { ...cx, loginPending: codexPending },
    };
}

function decodeJwtPayload(token: string): any {
    try {
        const payload = token.split(".")[1];
        if (!payload) return null;
        return JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
    } catch { return null; }
}

function decodeJwtExp(token: string | undefined): number | null {
    const p = token ? decodeJwtPayload(token) : null;
    return typeof p?.exp === "number" ? p.exp : null;
}
