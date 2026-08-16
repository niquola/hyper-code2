import { createServer } from "node:http";

/** Performs the llm.startAnthropicOAuth runtime operation. */
/**
 * Start the Anthropic OAuth authorization flow.
 * @param opts.listen Whether to listen locally for the OAuth callback.
 * @param opts.account Credential slot the resulting tokens are saved into.
 * @param opts.label Human-readable name for the account, e.g. the e-mail.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts?: {
        /** Value used for the listen option. */ listen?: boolean;
        /** Credential slot to log into, allowing a second Claude account. @default "default" */ account?: string;
        /** Human-readable account name shown in the UI. */ label?: string | null },
): Promise<{ authorizationUrl: string; expiresAt: number; callbackListening: boolean }> {
    const state = randomBase64Url(32);
    const verifier = randomBase64Url(32);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const challenge = Buffer.from(digest).toString("base64url");
    const c = ctx.fns.llm.anthropicOAuthConstants({});
    const root: any = ((ctx.state as any).llm ??= {});
    const store: any = (root.anthropicOAuth ??= { pending: new Map(), lastError: null });
    for (const p of store.pending.values()) try { p.server?.close(); } catch {}
    store.pending.clear();
    store.lastError = null;
    // Which credential slot this login fills travels with the pending flow, so
    // the callback saves a second Claude account instead of overwriting the
    // first one.
    const account = String(opts?.account ?? "").trim().slice(0, 40) || "default";
    const pending: any = { state, verifier, redirectUri: c.redirectUri, account, label: opts?.label ?? null, createdAt: Date.now(), expiresAt: Date.now() + 10 * 60_000, status: "pending", server: null };
    store.pending.set(state, pending);

    let callbackListening = false;
    if (opts?.listen !== false) {
        try {
            const u = new URL(c.redirectUri);
            if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") throw new Error("loopback required");
            const port = Number(u.port || 80);
            pending.server = createServer(async (req, res) => {
                const url = new URL(req.url ?? "", c.redirectUri);
                if (req.method !== "GET" || url.pathname !== u.pathname) return html(res, 404, "Callback not found");
                const error = url.searchParams.get("error");
                if (error) return html(res, 400, "Anthropic authentication did not complete");
                try {
                    await ctx.fns.llm.completeAnthropicOAuth({ code: url.searchParams.get("code") ?? "", state: url.searchParams.get("state") ?? "" });
                    return html(res, 200, "Anthropic connection completed. You can close this window.");
                } catch (e: any) { return html(res, 400, String(e?.message ?? "Anthropic OAuth login failed")); }
            });
            await new Promise<void>((resolve, reject) => {
                pending.server.once("error", reject);
                pending.server.listen(port, "127.0.0.1", () => { pending.server.off("error", reject); resolve(); });
            });
            callbackListening = true;
        } catch {
            try { pending.server?.close(); } catch {}
            pending.server = null; // manual paste remains available
        }
    }
    const q = new URLSearchParams({
        code: "true", client_id: c.clientId, response_type: "code", redirect_uri: c.redirectUri,
        scope: c.scopes, code_challenge: challenge, code_challenge_method: "S256", state,
    });
    const authorizationUrl = `${c.authorizeUrl}?${q}`;
    // Safe UI metadata only. The verifier remains exclusively on pending and
    // anthropicOAuthStatus deliberately never returns it.
    pending.authorizationUrl = authorizationUrl;
    pending.callbackListening = callbackListening;
    return { authorizationUrl, expiresAt: pending.expiresAt, callbackListening };
}

function randomBase64Url(n: number): string { return Buffer.from(crypto.getRandomValues(new Uint8Array(n))).toString("base64url"); }
function html(res: any, status: number, message: string) {
    res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
    res.end(`<p>${escapeHtml(message)}</p>`);
}
function escapeHtml(s: string) { return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
