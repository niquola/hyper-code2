import { resolve } from "node:path";

// google.reauth — ONE OAuth flow that grants every Google scope we use (gmail,
// calendar, docs, sheets, tasks, drive) into a single token, driven through the
// CDP Chrome (auto-consent via google.cdpOpen). Writes .secrets/google/token-
// <account>.json only on success. This is the single authorization entry point
// for all google-* modules — no more per-service tokens.
//
// Fully automatic for the account the CDP Chrome is signed into; otherwise it
// opens the window and waits for the human to finish login/2FA. Adding a scope
// later = extend GOOGLE_SCOPES and re-run this once per account.
export const GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.settings.basic",
    "https://www.googleapis.com/auth/gmail.settings.sharing",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/tasks",
    // Write, not readonly: creating a mailbox (a service sender, a new person)
    // goes through the same Directory API. It subsumes the readonly scope.
    "https://www.googleapis.com/auth/admin.directory.user",
    "https://www.googleapis.com/auth/admin.directory.group.readonly",
];

export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { account: string; port?: number; timeoutMs?: number; cdp?: boolean; scopes?: string[] }
) {
    const account = opts.account;
    if (!account || !account.includes("@")) throw new Error("account required, e.g. user@gmail.com");
    const port = opts.port ?? 8089;
    const timeoutMs = opts.timeoutMs ?? 180_000;
    const useCdp = opts.cdp !== false;
    const secretsDir = resolve(import.meta.dir, "../../.secrets/google");

    const cs = await Bun.file(resolve(secretsDir, "client_secret.json")).json();
    const c = cs.installed ?? cs.web;
    if (!c?.client_id) throw new Error("client_secret.json missing installed/web client_id");
    const { client_id, client_secret } = c;

    const redirectUri = `http://localhost:${port}`;
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", client_id);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", (opts.scopes ?? GOOGLE_SCOPES).join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("login_hint", account);

    let resolveCode!: (v: string) => void;
    let rejectCode!: (e: Error) => void;
    const codeP = new Promise<string>((res, rej) => { resolveCode = res; rejectCode = rej; });
    const server = Bun.serve({
        port,
        fetch(req) {
            const u = new URL(req.url);
            const code = u.searchParams.get("code");
            const err = u.searchParams.get("error");
            if (err) { rejectCode(new Error(`OAuth error: ${err}`)); return new Response("Auth failed — close this window."); }
            if (code) { resolveCode(code); return new Response("Authorized ✅ — you can close this window."); }
            return new Response("waiting for authorization…");
        },
    });

    let driver = "cdp";
    const done = () => codeP.then(() => true, () => true);
    if (useCdp && (await (ctx.fns.google as any).cdpOpen?.({ url: authUrl.toString(), account, done })?.catch?.(() => false))) driver = "cdp";
    else { Bun.spawn(["open", authUrl.toString()]); driver = useCdp ? "open(fallback)" : "open"; }

    let timer: any;
    const code = await Promise.race([
        codeP,
        new Promise<string>((_, rej) => { timer = setTimeout(() => rej(new Error(`timeout after ${timeoutMs}ms waiting for OAuth redirect`)), timeoutMs); }),
    ]).finally(() => { clearTimeout(timer); setTimeout(() => server.stop(true), 200); });

    const tok: any = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id, client_secret, code, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    }).then((r) => r.json());
    if (!tok.access_token) throw new Error(`token exchange failed: ${JSON.stringify(tok)}`);
    if (!tok.refresh_token) throw new Error("no refresh_token returned (add prompt=consent / revoke prior grant)");

    const token = { access_token: tok.access_token, refresh_token: tok.refresh_token, expires_at: Date.now() + (tok.expires_in ?? 3600) * 1000 };
    const tokenPath = resolve(secretsDir, `token-${account}.json`);
    await Bun.write(tokenPath, JSON.stringify(token, null, 2));
    await Bun.$`chmod 600 ${tokenPath}`.quiet().nothrow();
    if ((ctx.state as any).google?.tokens) delete (ctx.state as any).google.tokens[account];

    return { account, driver, saved: tokenPath, scope: tok.scope, expires_in: tok.expires_in };
}
