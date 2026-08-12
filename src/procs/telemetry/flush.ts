// Append one batch without reading/re-writing history. Serialized writes keep
// lines intact; failures drop diagnostics and never touch application work.
import { appendFile } from "node:fs/promises";

export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const st = ctx.state.procs?.telemetry as types.procs.telemetry.State | undefined;
    if (!st?.buffer.length) return;
    const lines = st.buffer.splice(0);
    const batch = lines.join("");
    st.flushChain = st.flushChain.then(async () => {
        try { await appendFile(st.file, batch, "utf8"); }
        catch (e: any) {
            st.dropped += lines.length;
            try { console.error("[telemetry.flush]", e?.message ?? e); } catch {}
        }
    });
    await st.flushChain;
}
