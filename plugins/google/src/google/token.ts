// google.token — unified access token for ALL Google APIs (gmail, calendar,
// docs, sheets, tasks, drive). One token per account under .secrets/google/,
// granted every scope at once (see google.reauth). Refreshes via client_secret
// when expired, caches in ctx.state.google.tokens. Every google-* module's
// token.ts delegates here, so there is a single credential to authorize.
// Account resolution: opts.account → env GOOGLE_ACCOUNT → the only account.
import { resolve } from "node:path";

export default async function (ctx: Context, _session: Session | null, opts?: { account?: string }) {
    const dir = resolve(import.meta.dir, "../../.secrets/google");
    let account = opts?.account ?? ctx.env.GOOGLE_ACCOUNT;
    if (!account) {
        const all = await ctx.fns.google.accounts({});
        if (all.length === 1) account = all[0]!;
        else throw new Error(`Specify account. Authorized: ${all.join(", ") || "(none)"} (or set GOOGLE_ACCOUNT). Run google.reauth({ account }) to add one.`);
    }

    const cache = ((ctx.state as any).google ??= { tokens: {} as Record<string, { access_token: string; expires_at: number }> });
    const cached = cache.tokens[account];
    if (cached && Date.now() < cached.expires_at - 60_000) return { account, access_token: cached.access_token };

    const safe = account.replace(/[^a-zA-Z0-9@._-]/g, "_");
    const tokenFile = Bun.file(resolve(dir, `token-${safe}.json`));
    if (!(await tokenFile.exists())) throw new Error(`No token for ${account}. Run: google.reauth({ account: "${account}" })`);
    let token = await tokenFile.json();

    if (!token.expires_at || Date.now() > token.expires_at - 60_000) {
        const secret = await Bun.file(resolve(dir, "client_secret.json")).json();
        const creds = secret.installed || secret.web;
        const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: creds.client_id,
                client_secret: creds.client_secret,
                refresh_token: token.refresh_token,
                grant_type: "refresh_token",
            }),
        });
        const json: any = await res.json();
        if (!res.ok || !json?.access_token) throw new Error(`Token refresh failed for ${account}: ${JSON.stringify(json)}`);
        token = { access_token: json.access_token, refresh_token: token.refresh_token, expires_at: Date.now() + (json.expires_in ?? 3600) * 1000 };
        await Bun.write(resolve(dir, `token-${safe}.json`), JSON.stringify(token, null, 2));
    }

    cache.tokens[account] = { access_token: token.access_token, expires_at: token.expires_at };
    return { account, access_token: token.access_token };
}
