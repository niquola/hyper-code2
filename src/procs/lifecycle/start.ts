import { setPath, getPath } from "../boot/load";
// Run each module's $start.ts in order (package.json procs.prod). A $start gets
// (ctx, config) and may RETURN a state object — merged into ctx.state.<module>
// (and handed back to $stop). Idempotent (a started module is skipped).
//
// **One module failing is not the host failing.** A host mounts modules it did
// not write and may not have configured; a workflow engine with no database, a
// mail sender with no key — none of that is a reason for a clinical host to
// refuse to boot. Such a module is recorded as failed, complained about loudly,
// and skipped; everything else starts.
//
// The framework's own modules are the exception, and so is anything a host
// declares `"required": true`: without `procs/http` there is no host to keep
// running, so those still roll back and throw.
//   ctx.fns.procs.lifecycle.start({})
/**
 * Starts module lifecycle hooks in dependency order and records their state.
 * Optional module failures produce a degraded result; required failures roll back and throw.
 */
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const order: string[] = await ctx.fns.procs.lifecycle.order({});
    const entries = await ctx.fns.procs.project.scan({});
    const life = (ctx.state.procs.lifecycle ??= { started: [], failed: {} });
    life.failed ??= {};

    for (const mod of order) {
        if (life.started.includes(mod)) continue;
        const e = entries.find((x: any) => x.kind === "lifecycle" && x.hook === "start" && x.moduleDir === mod);
        if (!e) continue; // module has no $start — nothing to init
        try {
            // Each module resolves its OWN config (ctx.fns.procs.config.resolve) inside
            // $start, so the bundle works without a config-injection step.
            const fn = (await import((e as any).abs + `?t=${Date.now()}`)).default;
            const state = await fn(ctx, null, {});
            if (state && typeof state === "object") {
                // A module's state lives under its own (possibly nested) name.
                const slot = getPath(ctx.state, mod.split("/")) ?? {};
                setPath(ctx.state, mod.split("/"), Object.assign(slot, state));
            }
            life.started.push(mod);
            ctx.fns.procs.log.info({ event: "lifecycle.started", msg: mod });
        } catch (err: any) {
            const message = String(err?.message ?? err);
            const required = mod.startsWith("procs/") || (await ctx.fns.procs.lifecycle.declared({ module: mod }))?.required === true;
            ctx.fns.procs.log.error({ event: "lifecycle.failed", msg: `${mod}: ${message}`, module: mod, required });
            life.failed[mod] = message;
            if (!required) continue;                  // the host keeps its other modules
            await ctx.fns.procs.lifecycle.stop({});   // core: roll back and say so
            throw err;
        }
    }
    const failed = Object.keys(life.failed);
    if (failed.length) {
        ctx.fns.procs.log.error({
            event: "lifecycle.degraded",
            msg: `started without ${failed.join(", ")} — see the errors above`,
            failed,
        });
    }
    return { started: [...life.started], failed: { ...life.failed } };
}
