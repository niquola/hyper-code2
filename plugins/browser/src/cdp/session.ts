// Return a live named CDP page websocket, attaching to a requested target or
// creating a background tab. Runtime handles are deliberately in ctx.state,
// never module globals, so hot reload does not fork the connection registry.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { name?: string; targetId?: string } = {},
): Promise<any> {
    const name = String(opts.name || "main");
    const state = ((ctx.state as any).cdp ??= { sessions: new Map() });
    const sessions: Map<string, any> = (state.sessions ??= new Map());
    const existing = sessions.get(name);
    if (existing?.ws?.readyState === WebSocket.OPEN) {
        existing.lastUsed = Date.now();
        return existing;
    }

    const browserUrl = String(ctx.env.CDP_BROWSER_URL || "http://127.0.0.1:9222").replace(/\/$/, "");
    let targetId = opts.targetId;
    if (!targetId) {
        const version = await fetch(`${browserUrl}/json/version`, { signal: AbortSignal.timeout(3000) });
        if (!version.ok) throw new Error(`Chrome CDP unavailable at ${browserUrl} (${version.status})`);
        const info: any = await version.json();
        targetId = await new Promise<string>((resolve, reject) => {
            const ws = new WebSocket(info.webSocketDebuggerUrl);
            const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error("CDP Target.createTarget timed out")); }, 5000);
            ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: "Target.createTarget", params: { url: "about:blank", background: true } }));
            ws.onmessage = (event) => {
                const message = JSON.parse(String(event.data));
                if (message.id !== 1) return;
                clearTimeout(timer);
                ws.close();
                if (message.error) reject(new Error(message.error.message));
                else resolve(message.result.targetId);
            };
            ws.onerror = () => { clearTimeout(timer); reject(new Error("CDP browser websocket failed")); };
        });
    }

    const wsUrl = `${browserUrl.replace(/^http/, "ws")}/devtools/page/${targetId}`;
    return await new Promise<any>((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const handle: any = { name, targetId, ws, msgId: 0, pending: new Map(), lastUsed: Date.now() };
        const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error("CDP page websocket timed out")); }, 5000);
        ws.onopen = () => {
            clearTimeout(timer);
            sessions.set(name, handle);
            resolve(handle);
        };
        ws.onmessage = (event) => {
            const message = JSON.parse(String(event.data));
            const pending = message.id ? handle.pending.get(message.id) : null;
            if (!pending) return;
            handle.pending.delete(message.id);
            message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
        };
        ws.onerror = () => { clearTimeout(timer); reject(new Error(`CDP tab ${targetId} websocket failed`)); };
        ws.onclose = () => { if (sessions.get(name) === handle) sessions.delete(name); };
    });
}
