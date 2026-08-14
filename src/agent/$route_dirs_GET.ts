// GET /agent/dirs?q=/Users/niq — directory autocomplete for the workdir field.
// The typed value's dirname is listed, filtered by the basename prefix, and
// returned as <option>s for the datalist the input points at. Hidden folders
// stay hidden unless the prefix asks for them.
import { readdir } from "node:fs/promises";
import { dirname, basename } from "node:path";

/** Handles the dirs get HTTP route.  * @param opts.req Incoming HTTP request.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Incoming HTTP request. */
req: Request }) {
    const esc = (s: any) => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
    let q = String(new URL(opts.req.url).searchParams.get("q") ?? "").trim();
    if (!q) q = (ctx.env.HOME ?? "/") + "/";
    if (q.startsWith("~")) q = (ctx.env.HOME ?? "") + q.slice(1);

    // "/a/b/pre" → list /a/b filtered by "pre"; "/a/b/" → list /a/b whole.
    const dir = q.endsWith("/") ? q.slice(0, -1) || "/" : dirname(q);
    const prefix = q.endsWith("/") ? "" : basename(q);
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const dirs = entries
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .filter(n => (prefix.startsWith(".") ? true : !n.startsWith(".")) && n.toLowerCase().startsWith(prefix.toLowerCase()))
        .sort()
        .slice(0, 20)
        .map(n => `<option value="${esc(`${dir === "/" ? "" : dir}/${n}`)}"></option>`)
        .join("");
    return new Response(dirs, { headers: { "content-type": "text/html; charset=utf-8" } });
}
