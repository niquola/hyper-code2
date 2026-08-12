// Compact current tracer/process health for diagnosis from the REPL.
export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    const st = ctx.state.procs?.telemetry as types.procs.telemetry.State | undefined;
    const memory = process.memoryUsage();
    return {
        enabled: st?.enabled ?? false,
        file: st?.file,
        activeSpans: st?.active.size ?? 0,
        recentSpans: st?.recent.length ?? 0,
        buffered: st?.buffer.length ?? 0,
        dropped: st?.dropped ?? 0,
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        uptimeSec: Math.round(process.uptime()),
    };
}
