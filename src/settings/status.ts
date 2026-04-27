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
} {
    const env = ctx.env;
    const home = env.HOME ?? process.env.HOME ?? "";
    let kc: { loggedIn: boolean; expSec: number | null } = { loggedIn: false, expSec: null };
    try {
        const j = JSON.parse(readFileSync(`${home}/.kimi/credentials/kimi-code.json`, "utf8"));
        const exp = decodeJwtExp(j.access_token);
        kc = { loggedIn: !!j.access_token, expSec: exp };
    } catch { /* not logged in */ }
    const pending = !!(ctx.state as any).settings?.kimi?.userCode
        && (ctx.state as any).settings?.kimi?.status === "pending";
    return {
        openai: { set: !!env.OPENAI_API_KEY },
        anthropic: { set: !!env.ANTHROPIC_API_KEY },
        kimi: { set: !!env.KIMI_API_KEY },
        groq: { set: !!env.GROQ_API_KEY },
        openrouter: { set: !!env.OPENROUTER_API_KEY },
        kimiCoding: { ...kc, loginPending: pending },
    };
}

function decodeJwtExp(token: string | undefined): number | null {
    if (!token) return null;
    try {
        const payload = token.split(".")[1];
        if (!payload) return null;
        const json = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
        return typeof json.exp === "number" ? json.exp : null;
    } catch { return null; }
}
