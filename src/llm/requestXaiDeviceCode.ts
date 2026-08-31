/** Request and validate an RFC 8628 device code from xAI. */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<{
    deviceCode: string; userCode: string; verificationUri: string; verificationUriComplete: string | null;
    intervalSeconds: number; expiresInSeconds: number;
}> {
    const c = ctx.fns.llm.xaiOAuthConstants({});
    let response: Response;
    try {
        response = await fetch(c.deviceCodeUrl, {
            method: "POST", headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ client_id: c.clientId, scope: c.scope, referrer: "pi" }), signal: AbortSignal.timeout(30_000),
        });
    } catch { throw new Error("xAI OAuth connection unavailable"); }
    const body: any = await response.json().catch(() => null);
    if (!body || typeof body !== "object") throw new Error(`xAI OAuth returned invalid JSON (HTTP ${response.status})`);
    if (!response.ok) throw failure("device authorization", response.status, body);
    const required = (field: string) => {
        if (typeof body[field] !== "string" || !body[field]) throw new Error(`Invalid xAI OAuth response field: ${field}`);
        return body[field] as string;
    };
    const positive = (field: string) => {
        if (typeof body[field] !== "number" || !Number.isFinite(body[field]) || body[field] <= 0) throw new Error(`Invalid xAI OAuth response field: ${field}`);
        return body[field] as number;
    };
    const safeUrl = (raw: string) => { try { const u = new URL(raw); if (u.protocol === "https:") return u.href; } catch {} throw new Error("Untrusted verification URI in xAI OAuth response"); };
    const complete = typeof body.verification_uri_complete === "string" && body.verification_uri_complete ? safeUrl(body.verification_uri_complete) : null;
    return { deviceCode: required("device_code"), userCode: required("user_code"), verificationUri: safeUrl(required("verification_uri")), verificationUriComplete: complete,
        intervalSeconds: typeof body.interval === "number" && body.interval > 0 ? body.interval : 5, expiresInSeconds: positive("expires_in") };
}
function failure(action: string, status: number, body: any) { const detail = [body.error, body.error_description].filter((x: any) => typeof x === "string").join(": "); return new Error(`xAI OAuth ${action} failed (HTTP ${status})${detail ? `: ${detail}` : ""}`); }
