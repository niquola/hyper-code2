// How a tool call presents itself in the chat: an icon, a verb, and — the part
// that matters — the SUBJECT it acted on.
//
// A card that says "args 63c" tells the reader nothing; "read src/tools/call.ts"
// tells them what happened without opening anything. So each tool names the one
// argument a human would have asked about, and the rest stays folded away.
//
// One table, read by both the card and anything else that lists calls, so a new
// tool cannot end up with an icon in one place and a wrench in the other.
const META: Record<string, { icon: string; label: string }> = {
    read:  { icon: "ph-file-text",       label: "read" },
    write: { icon: "ph-file-plus",       label: "write" },
    edit:  { icon: "ph-pencil-simple",   label: "edit" },
    grep:  { icon: "ph-magnifying-glass", label: "grep" },
    bash:  { icon: "ph-terminal-window", label: "bash" },
    eval:  { icon: "ph-brackets-curly",  label: "eval" },
    html:  { icon: "ph-browser",         label: "html" },
};

/** Tool meta for the runtime.  * @param opts.name Tool or operation name.
 * @param opts.args Tool arguments.
*/
export default function (
    _ctx: Context,
    _session: Session | null,
    opts: {
        /** Name of the target resource or runtime function. */
    name: string;
        /** Arguments supplied to the target runtime function. */
    args?: any },
): { icon: string; label: string; subject: string } {
    const name = String(opts.name ?? "tool");
    const args = opts.args ?? {};
    const meta = META[name] ?? { icon: "ph-wrench", label: name };
    return { ...meta, subject: subject(name, args) };
}

function subject(name: string, args: any): string {
    if (name === "read") {
        const range = args.startLine || args.endLine || args.maxLines
            ? ` :${args.startLine ?? 1}${args.endLine ? `-${args.endLine}` : args.maxLines ? `+${args.maxLines}` : ""}`
            : "";
        return `${args.path ?? ""}${range}${args.hashline ? " #" : ""}`;
    }
    if (name === "write") return String(args.path ?? "");
    if (name === "edit") {
        const n = Array.isArray(args.edits) ? args.edits.length : 0;
        return `${args.path ?? ""}${n ? ` · ${n} edit${n === 1 ? "" : "s"}` : ""}`;
    }
    if (name === "grep") {
        const where = args.path ? ` in ${args.path}` : "";
        const glob = args.glob ? ` (${args.glob})` : "";
        return `/${args.pattern ?? ""}/${where}${glob}`;
    }
    if (name === "bash") return firstLine(args.command);
    if (name === "eval") return firstLine(args.code);
    return firstLine(typeof args === "string" ? args : JSON.stringify(args));
}

// The first meaningful line, short enough for one row. A shell script or a
// snippet of code says what it is in its first line far better than a byte count.
function firstLine(text: any): string {
    const line = String(text ?? "").split("\n").map(l => l.trim()).find(Boolean) ?? "";
    return line.length > 90 ? line.slice(0, 90) + "…" : line;
}
