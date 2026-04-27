import { unlinkSync } from "node:fs";

// Wipes ~/.kimi/credentials/kimi-code.json and any in-flight login state.
export default function (ctx: Context): { ok: true } {
    const home = ctx.env.HOME ?? process.env.HOME ?? "";
    try { unlinkSync(`${home}/.kimi/credentials/kimi-code.json`); } catch { /* already gone */ }
    const s = (ctx.state as any).settings;
    if (s) delete s.kimi;
    return { ok: true };
}
