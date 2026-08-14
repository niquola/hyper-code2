import { getPath } from "../boot/load";
// Run each started module's $stop.ts in REVERSE order. $stop gets
// (ctx, state) — the state its $start returned (ctx.state.<module>) — to tear
// down (close connections, stop the server). Errors are logged, not fatal.
//   ctx.fns.procs.lifecycle.stop({})
/**
 * Stops started modules in reverse lifecycle order and clears lifecycle state.
 * Stop-hook failures are logged and do not prevent remaining modules from stopping.
 */
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const started: string[] = ctx.state.procs?.lifecycle?.started ?? [];
    const entries = await ctx.fns.procs.project.scan({});
    const stopped: string[] = [];

    for (const mod of [...started].reverse()) {
        const e = entries.find((x: any) => x.kind === "lifecycle" && x.hook === "stop" && x.moduleDir === mod);
        if (!e) continue;
        try {
            const fn = (await import((e as any).abs + `?t=${Date.now()}`)).default;
            await fn(ctx, null, getPath(ctx.state, mod.split('/')));
            stopped.push(mod);
            ctx.fns.procs.log.info({ event: "lifecycle.stopped", msg: mod });
        } catch (err: any) {
            ctx.fns.procs.log.error({ event: "lifecycle.stopFailed", msg: `${mod}: ${err?.message ?? err}` });
        }
    }
    ctx.state.procs.lifecycle = { started: [], failed: {} };
    return { stopped };
}
