/**
 * Start an xAI RFC 8628 device authorization flow.
 *
 * Requests a public user code, keeps the device code only in runtime state and
 * polls in the background until encrypted credentials are stored or the flow
 * expires. Use from the Grok account-login UI.
 *
 * @param opts.account Named credential slot receiving the login. @default "default"
 * @param opts.label Human-readable account label shown in settings.
 */
export default async function (ctx: Context, _session: Session | null, opts?: {
    /** Named credential slot receiving the login. @default "default" */ account?: string;
    /** Human-readable account label shown in settings. */ label?: string | null;
}): Promise<{ userCode: string; verificationUri: string; verificationUriComplete: string | null; expiresAt: number; intervalSeconds: number }> {
    const device = await ctx.fns.llm.requestXaiDeviceCode({});
    const root: any = ((ctx.state as any).llm ??= {}), store: any = (root.xaiOAuth ??= { pending: new Map(), lastError: null });
    const account = String(opts?.account ?? "").trim().slice(0, 40) || "default", expiresAt = Date.now() + device.expiresInSeconds * 1000;
    const pending: any = { account, label: opts?.label ?? null, userCode: device.userCode, verificationUri: device.verificationUriComplete ?? device.verificationUri, expiresAt, intervalSeconds: device.intervalSeconds, status: "pending", cancelled: false };
    store.pending.set(account, pending); store.lastError = null;
    void poll(ctx, device, pending).catch((e: any) => { pending.status = "failed"; pending.error = String(e?.message ?? e); store.lastError = pending.error; });
    return { userCode: device.userCode, verificationUri: device.verificationUri, verificationUriComplete: device.verificationUriComplete, expiresAt, intervalSeconds: device.intervalSeconds };
}
async function poll(ctx: Context, device: any, pending: any) {
    let interval = device.intervalSeconds;
    while (!pending.cancelled && Date.now() < pending.expiresAt) {
        await Bun.sleep(interval * 1000); if (pending.cancelled) return;
        try { const token = await ctx.fns.llm.exchangeXaiOAuth({ grant: "device_code", deviceCode: device.deviceCode }); await ctx.fns.llm.saveXaiOAuth({ ...token, account: pending.account, label: pending.label }); pending.status = "connected"; return; }
        catch (e: any) { if (e.code === "authorization_pending") continue; if (e.code === "slow_down") { interval = e.interval > 0 ? e.interval : interval + 5; pending.intervalSeconds = interval; continue; } if (e.code === "expired_token") { pending.status = "expired"; return; } throw e; }
    }
    if (!pending.cancelled) pending.status = "expired";
}
