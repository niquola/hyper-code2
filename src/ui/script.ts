// Emit <script src="..."> tag for a module script registered via the
// $script_<name>.js convention. Target is dotted: "agent.chat" → /agent/chat.js.
// Root-level "<name>" → /<name>.js.
export default function (_ctx: Context, opts: { target: string; defer?: boolean; module?: boolean }): string {
    const target = opts.target;
    const segs = target.split(".");
    const name = segs.pop()!;
    const prefix = segs.length ? "/" + segs.join("/") + "/" : "/";
    const attrs = [
        `src="${prefix}${name}.js"`,
        opts.module ? 'type="module"' : "",
        opts.defer !== false ? "defer" : "",
    ].filter(Boolean).join(" ");
    return `<script ${attrs}></script>`;
}
