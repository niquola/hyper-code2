// Cheap validity check for a marker call BEFORE anything executes (co's
// review, point 3): a §eval whose body does not even parse, an §edit without
// its @PATH header, a §grep without a pattern — all fail here with the hint
// the model needs. run() uses this to decide repair-vs-execute; executeMarker
// runs it again so a preflight failure travels the normal error-result path.
export default function (
    _ctx: Context,
    _session: Session | null,
    opts: { call: types.agent.MarkerCall },
): { ok: boolean; hint?: string } {
    const call: any = opts.call;
    if (call.kind === "eval" || call.kind === "evalHtml") {
        const d = _ctx.fns.repl.diagnoseParse({ code: String(call.content ?? "") });
        return d.ok ? { ok: true } : { ok: false, hint: d.hint };
    }
    if (call.kind === "write") {
        const p = String(call.path ?? "").trim();
        if (!p || p.includes("\u0000")) return { ok: false, hint: "write needs a valid relative path in §write:<path>" };
        return { ok: true };
    }
    if (call.kind === "edit") {
        const first = String(call.content ?? "").split("\n").find((l: string) => l.trim() !== "") ?? "";
        if (!first.startsWith("@")) return { ok: false, hint: "edit body must start with @<path> on its own line (read the file with §read:hashline first)" };
        return { ok: true };
    }
    if (call.kind === "grep") {
        const hasPattern = String(call.content ?? "").split("\n").some((l: string) => l.trim().startsWith("pattern:") && l.split(":").slice(1).join(":").trim() !== "");
        if (!hasPattern) return { ok: false, hint: "grep body needs a 'pattern: …' line" };
        return { ok: true };
    }
    if (call.kind === "read") {
        if (!String(call.path ?? "").trim()) return { ok: false, hint: "read body needs a path" };
        return { ok: true };
    }
    return { ok: true };   // html/bash — anything goes
}
