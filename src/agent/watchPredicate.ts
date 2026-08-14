/** Watch predicate for the runtime.  * @param opts.predicate Conditional wake predicate type.
 * @param opts.opts Predicate-specific options.
*/
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Predicate used to decide when the agent should wake. */
    predicate: string;
        /** Options forwarded to the selected operation. */
    opts: Record<string, any> },
): Promise<{ ready: boolean; result?: any }> {
    const input = opts.opts ?? {};
    switch (opts.predicate) {
        case "file.exists": {
            const exists = await ctx.fns.files.exists({ path: String(input.path ?? "") });
            return { ready: !!exists, ...(exists ? { result: { path: input.path, exists: true } } : {}) };
        }
        case "db.rows": {
            const sql = String(input.sql ?? "").trim();
            if (!/^select\b/i.test(sql) || /;\s*\S/.test(sql)) throw new Error("db.rows accepts one SELECT statement only");
            const rows = await ctx.fns.procs.db.select({ sql, params: Array.isArray(input.params) ? input.params : [] });
            return { ready: rows.length > 0, ...(rows.length ? { result: rows.slice(0, 20) } : {}) };
        }
        case "http.ok": {
            const url = String(input.url ?? "");
            if (!/^https?:\/\//i.test(url)) throw new Error("http.ok requires an http(s) URL");
            const response = await fetch(url, { method: "GET", signal: AbortSignal.timeout(10_000) });
            return { ready: response.ok, ...(response.ok ? { result: { url, status: response.status } } : {}) };
        }
        case "runtime.fn": {
            const name = String(input.name ?? "").trim();
            if (!/^[a-zA-Z][\w-]*(?:\.[a-zA-Z][\w-]*)+$/.test(name)) throw new Error("runtime.fn requires a dotted function name");
            const parts = name.split(".");
            let fn: any = ctx.fns;
            for (const part of parts) fn = fn?.[part];
            if (typeof fn !== "function") throw new Error(`runtime function not found: ${name}`);
            const timeoutMs = Math.max(100, Math.min(60_000, Number(input.callTimeoutMs ?? 15_000)));
            const value = await Promise.race([
                fn(input.args ?? {}),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`runtime function timed out after ${timeoutMs}ms`)), timeoutMs)),
            ]);
            if (!value || typeof value.ready !== "boolean") throw new Error(`runtime function ${name} must return { ready: boolean, result?: any }`);
            return value.ready ? { ready: true, result: value.result ?? true } : { ready: false };
        }

        default:
            throw new Error(`unknown wake predicate: ${opts.predicate}`);
    }
}
