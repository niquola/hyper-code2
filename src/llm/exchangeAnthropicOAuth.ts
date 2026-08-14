// Exchange an authorization code or rotating refresh token. Errors are
// deliberately sanitized: token endpoint bodies can contain secrets.
/**
 * Exchange an Anthropic authorization code or refresh token for OAuth credentials.
 * @param opts.grant OAuth grant type that selects the exchange payload.
 * @param opts.code Authorization code returned by Anthropic.
 * @param opts.state OAuth state returned with the authorization code.
 * @param opts.verifier PKCE verifier created when authorization started.
 * @param opts.redirectUri Redirect URI used for the authorization request.
 * @param opts.refreshToken Refresh token used to rotate credentials.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Authorization-code grant discriminator. */ grant: "authorization_code";
        /** Authorization code returned by Anthropic. */ code: string;
        /** OAuth state returned with the authorization code. */ state: string;
        /** PKCE verifier created when authorization started. */ verifier: string;
        /** Redirect URI used for the authorization request. */ redirectUri: string;
    } | {
        /** Refresh-token grant discriminator. */ grant: "refresh_token";
        /** Refresh token used to rotate credentials. */ refreshToken: string;
    },
): Promise<{ access: string; refresh: string | null; expiresAt: number; scopes: string | null }> {
    const c = ctx.fns.llm.anthropicOAuthConstants({});
    const body: any = opts.grant === "authorization_code" ? {
        grant_type: "authorization_code", client_id: c.clientId,
        code: opts.code, state: opts.state, redirect_uri: opts.redirectUri, code_verifier: opts.verifier,
    } : {
        grant_type: "refresh_token", client_id: c.clientId, refresh_token: opts.refreshToken,
    };
    let res: Response;
    try {
        res = await fetch(c.tokenUrl, {
            method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify(body), signal: AbortSignal.timeout(30_000),
        });
    } catch { throw new Error("Anthropic OAuth connection unavailable"); }
    if (!res.ok) { await res.text().catch(() => ""); throw new Error("Anthropic OAuth token exchange rejected"); }
    let data: any;
    try { data = await res.json(); } catch { throw new Error("Anthropic OAuth token exchange returned an invalid response"); }
    if (typeof data.access_token !== "string" || !data.access_token || typeof data.expires_in !== "number") {
        throw new Error("Anthropic OAuth token exchange returned an invalid response");
    }
    return {
        access: data.access_token,
        refresh: typeof data.refresh_token === "string" && data.refresh_token ? data.refresh_token : null,
        expiresAt: Date.now() + data.expires_in * 1000 - 5 * 60_000,
        scopes: typeof data.scope === "string" ? data.scope : null,
    };
}
