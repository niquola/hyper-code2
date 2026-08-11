// Send one command over a named CDP page session with a bounded wait.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { method: string; params?: Record<string, any>; session?: string; timeoutMs?: number },
): Promise<any> {
    const name = String(opts.session || "main");
    let handle = await ctx.fns.cdp.session({ name });
    const call = async () => {
        const id = ++handle.msgId;
        return await new Promise<any>((resolve, reject) => {
            const timer = setTimeout(() => {
                handle.pending.delete(id);
                reject(new Error(`CDP ${opts.method} timed out after ${opts.timeoutMs ?? 20000}ms`));
            }, opts.timeoutMs ?? 20000);
            handle.pending.set(id, {
                resolve: (value: any) => { clearTimeout(timer); resolve(value); },
                reject: (error: any) => { clearTimeout(timer); reject(error); },
            });
            handle.ws.send(JSON.stringify({ id, method: opts.method, params: opts.params ?? {} }));
        });
    };

    try {
        return await call();
    } catch (error) {
        try { handle.ws.close(); } catch {}
        ((ctx.state as any).cdp?.sessions as Map<string, any> | undefined)?.delete(name);
        handle = await ctx.fns.cdp.session({ name });
        return await call().catch(() => { throw error; });
    }
}
