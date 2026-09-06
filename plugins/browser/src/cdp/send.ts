// Send one command over a named CDP page session with a bounded wait.
/**
 * Sends a CDP command exactly once through a named page session.
 * Reconnects before sending if needed; never retries a command after an error or timeout,
 * since a mutation may already have executed.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
  /** CDP protocol method name. */
  method: string;
  /** Optional parameters for the CDP method. */
  params?: Record<string, any>;
  /** Logical browser session name. */
  session?: string;
  /** Maximum command duration in milliseconds. */
  timeoutMs?: number },
): Promise<any> {
    const scope = await ctx.fns.cdp.scope({ session: opts.session });
    if (scope.bound && /^(Target|Browser)\./.test(opts.method)) throw new Error("Browser-wide CDP commands are unavailable to a bound agent");
    const handle = await ctx.fns.cdp.session({ name: scope.session, targetId: scope.targetId });
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
            try {
                handle.ws.send(JSON.stringify({ id, method: opts.method, params: opts.params ?? {} }));
            } catch (error) {
                handle.pending.delete(id);
                clearTimeout(timer);
                reject(error);
            }
        });
    };

    return await call();
}
