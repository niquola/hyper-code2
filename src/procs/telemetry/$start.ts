// Start the dependency-free NDJSON tracer before DB/HTTP/agent lifecycle hooks.
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir } from "node:fs/promises";

/**
 * Start the telemetry subsystem.
 */
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const config = ctx.fns.procs.config.resolve({ module: "procs/telemetry" }) as ConfigOf<typeof import("./$config").default>;
    const dir = ctx.fns.procs.project.runtimeDir({});
    await mkdir(dir, { recursive: true });
    const file = `${dir}/telemetry.ndjson`;
    const st: types.procs.telemetry.State = ctx.state.procs.telemetry = {
        enabled: config.enabled,
        file,
        slowMs: config.slowMs,
        maxRecent: config.maxRecent,
        recent: [],
        active: new Map(),
        buffer: [],
        flushChain: Promise.resolve(),
        als: new AsyncLocalStorage(),
        dropped: 0,
    };
    st.flushTimer = setInterval(() => { void ctx.fns.procs.telemetry.flush({}); }, Math.max(100, config.flushMs));
    st.flushTimer.unref?.();
    ctx.fns.procs.log.info({ event: "telemetry.started", msg: file, file, slowMs: st.slowMs });
}
