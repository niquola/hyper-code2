import { unlinkSync } from "node:fs";

// Wipes ~/.codex/auth.json and any in-flight login state.
export default function (ctx: Context): { ok: true } {
    const home = ctx.env.HOME ?? process.env.HOME ?? "";
    try { unlinkSync(`${home}/.codex/auth.json`); } catch { /* already gone */ }
    const s = (ctx.state as any).settings;
    if (s?.codex?.proc) { try { s.codex.proc.kill(); } catch { /* ignore */ } }
    if (s) delete s.codex;
    return { ok: true };
}
