/** Exchange an xAI device code or refresh token for OAuth tokens. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Grant being exchanged. */ grant: "device_code" | "refresh_token";
    /** Device code for a device-code exchange. */ deviceCode?: string;
    /** Refresh token for token rotation. */ refreshToken?: string;
}): Promise<{ access: string; refresh: string; expiresAt: number; scopes: string | null }> {
    const c = ctx.fns.llm.xaiOAuthConstants({});
    const fields: Record<string, string> = opts.grant === "device_code"
        ? { grant_type: "urn:ietf:params:oauth:grant-type:device_code", client_id: c.clientId, device_code: String(opts.deviceCode ?? "") }
        : { grant_type: "refresh_token", client_id: c.clientId, refresh_token: String(opts.refreshToken ?? "") };
    let response: Response;
    try { response = await fetch(c.tokenUrl, { method: "POST", headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields), signal: AbortSignal.timeout(30_000) }); }
    catch { throw new Error("xAI OAuth connection unavailable"); }
    const body: any = await response.json().catch(() => null);
    if (!body || typeof body !== "object") throw new Error(`xAI OAuth returned invalid JSON (HTTP ${response.status})`);
    if (!response.ok) {
        const detail = [body.error, body.error_description].filter((x: any) => typeof x === "string").join(": ");
        const error: any = new Error(`xAI OAuth token ${opts.grant === "refresh_token" ? "refresh" : "exchange"} failed (HTTP ${response.status})${detail ? `: ${detail}` : ""}`);
        error.code = typeof body.error === "string" ? body.error : null;
        error.interval = typeof body.interval === "number" ? body.interval : null;
        throw error;
    }
    if (typeof body.access_token !== "string" || !body.access_token) throw new Error("Invalid xAI OAuth response field: access_token");
    const refresh = typeof body.refresh_token === "string" && body.refresh_token ? body.refresh_token : opts.refreshToken;
    if (!refresh) throw new Error("Invalid xAI OAuth response field: refresh_token");
    const expires = body.expires_in === undefined ? 3600 : body.expires_in;
    if (typeof expires !== "number" || !Number.isFinite(expires) || expires <= 0) throw new Error("Invalid xAI OAuth response field: expires_in");
    return { access: body.access_token, refresh, expiresAt: Date.now() + expires * 1000 - 300_000, scopes: typeof body.scope === "string" ? body.scope : null };
}
