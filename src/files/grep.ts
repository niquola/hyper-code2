// Search file contents. ripgrep does the work when it is installed (it honours
// .gitignore, skips binaries and parallelises across cores); the in-process
// scan below is the fallback for a machine without it.
//
// rg is spawned with --json, so matches arrive as structured events rather than
// as text we would have to un-parse — and the child is killed the moment the
// limit is reached instead of searching the rest of the tree for nothing.
import { relative } from "node:path";

export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        pattern: string;
        path?: string;
        glob?: string;
        ignoreCase?: boolean;
        literal?: boolean;
        context?: number;
        limit?: number;
        noIgnore?: boolean;
        hidden?: boolean;
        timeout?: number;
    },
): Promise<types.files.GrepMatch[]> {
    // Always search FROM the workspace root and point rg at the target, rather
    // than making the target the working directory: a `path` naming a single
    // file used to become the cwd and failed with ENOTDIR. This also means the
    // paths rg prints are already relative to the workspace, which is the same
    // frame ctx.fns.files.read resolves in.
    const root = ctx.fns.files.resolveSafe({ path: "" });
    const abs = ctx.fns.files.resolveSafe({ path: opts.path ?? "" });
    const rel = relative(root, abs);
    const target = rel === "" ? "." : rel.startsWith("..") ? abs : rel;
    const limit = Math.max(1, opts.limit ?? 50);

    if (!(await Bun.file(abs).exists()) && !(await isDir(abs))) {
        throw new Error(`no such file or directory: ${opts.path ?? "."}`);
    }

    const rg = ctx.fns.files.rgPath({});
    const matches = rg
        ? await viaRipgrep(rg, root, target, opts, limit)
        : await viaScan(ctx, root, abs, target, opts, limit);

    if (opts.context && opts.context > 0) await attachContext(ctx, matches, opts.context);
    return matches;
}

async function viaRipgrep(
    rg: string,
    root: string,
    target: string,
    opts: any,
    limit: number,
): Promise<types.files.GrepMatch[]> {
    // --no-require-git: rg only applies .gitignore inside a repository, and an
    // agent's workspace is often just a directory. Without this, searching a
    // non-repo silently returns node_modules and build output.
    const args = ["--json", "--line-number", "--column", "--color=never", "--no-require-git"];
    if (opts.ignoreCase) args.push("--ignore-case");
    if (opts.literal) args.push("--fixed-strings");
    if (opts.glob) args.push("--glob", opts.glob);
    if (opts.noIgnore) args.push("--no-ignore");
    if (opts.hidden) args.push("--hidden");
    args.push("--", String(opts.pattern), target);

    const proc = Bun.spawn({ cmd: [rg, ...args], cwd: root, stdout: "pipe", stderr: "pipe" });
    // A search over an unbounded tree is where an agent hangs. With a deadline
    // it comes back with what it found instead of being killed from outside
    // with nothing to show.
    const seconds = Number(opts.timeout);
    let timedOut = false;
    const timer = Number.isFinite(seconds) && seconds > 0
        ? setTimeout(() => { timedOut = true; proc.kill(9); }, seconds * 1000)
        : null;

    const out: types.files.GrepMatch[] = [];
    const decoder = new TextDecoder();
    let buf = "";
    let killed = false;

    outer: for await (const chunk of proc.stdout as ReadableStream<Uint8Array>) {
        buf += decoder.decode(chunk, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (!line.trim()) continue;
            let ev: any;
            try { ev = JSON.parse(line); } catch { continue; }
            if (ev.type !== "match") continue;

            const sub = ev.data?.submatches?.[0];
            out.push({
                path: String(ev.data?.path?.text ?? "").replace(/^\.\//, ""),
                line: Number(ev.data?.line_number ?? 0),
                // rg reports byte offsets within the line; +1 to match our
                // 1-based columns.
                column: Number(sub?.start ?? 0) + 1,
                text: String(ev.data?.lines?.text ?? "").replace(/\r?\n$/, ""),
            });
            // Enough found: stop the search rather than read it to the end.
            if (out.length >= limit) { killed = true; proc.kill(9); break outer; }
        }
    }

    if (timer) clearTimeout(timer);
    if (!killed && !timedOut) {
        const code = await proc.exited;
        // rg exits 1 on "no matches", >1 on a real problem (bad regex, no such
        // path) — that is worth telling the model about.
        if (code > 1) {
            // rg puts the useful part of a regex parse error on the lines AFTER
            // "regex parse error:" — keeping only the first line threw the
            // diagnosis away and left the model guessing.
            const err = (await new Response(proc.stderr).text()).trim();
            throw new Error(err.replace(/^rg:\s*/, "").slice(0, 600) || `ripgrep exited ${code}`);
        }
    }
    return out;
}

// No ripgrep: walk the glob ourselves. One regex pass over the whole file (not
// per line) and line numbers derived from the match offset — the per-line exec
// this used to do cost a call per line of every file scanned.
async function viaScan(
    ctx: Context,
    root: string,
    abs: string,
    target: string,
    opts: any,
    limit: number,
): Promise<types.files.GrepMatch[]> {
    const flags = opts.ignoreCase ? "gi" : "g";
    const source = opts.literal ? escapeRegExp(String(opts.pattern)) : String(opts.pattern);
    const re = new RegExp(source, flags);
    const skip = /(^|\/)(node_modules|\.git|\.runtime|dist|build)(\/|$)/;

    // A target that is a single file is searched as itself — pointing a glob
    // scan at a file yields nothing, which is how the rg path used to fail too.
    const isFile = await Bun.file(abs).exists();
    const files: string[] = [];
    if (isFile) {
        files.push(target === "." ? "" : target);
    } else {
        const prefix = target === "." ? "" : `${target}/`;
        for await (const rel of new Bun.Glob(opts.glob ?? "**/*").scan({ cwd: abs, onlyFiles: true })) {
            if (skip.test(rel)) continue;
            files.push(prefix + rel);
        }
    }

    const out: types.files.GrepMatch[] = [];
    for (const path of files) {
        let text = "";
        try { text = await ctx.fns.files.read({ path }); } catch { continue; }
        if (text.includes("\u0000")) continue;            // binary

        const body = text.replaceAll("\r\n", "\n");
        re.lastIndex = 0;
        let lineNo = 1;
        let lineStart = 0;
        let scanned = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(body)) !== null) {
            while (scanned < m.index) {
                if (body.charCodeAt(scanned) === 10) { lineNo++; lineStart = scanned + 1; }
                scanned++;
            }
            const lineEnd = body.indexOf("\n", m.index);
            out.push({
                path,
                line: lineNo,
                column: m.index - lineStart + 1,
                text: body.slice(lineStart, lineEnd < 0 ? body.length : lineEnd),
            });
            if (out.length >= limit) return out;
            // One match per line, like ripgrep's default output.
            re.lastIndex = lineEnd < 0 ? body.length : lineEnd + 1;
            if (m[0].length === 0) re.lastIndex++;
        }
    }
    return out;
}

// Context lines are read here rather than asked of rg: correlating rg's
// separate context events back to their match costs more than re-reading the
// file, and the fallback would need this code anyway.
async function attachContext(ctx: Context, matches: types.files.GrepMatch[], context: number): Promise<void> {
    const cache = new Map<string, string[]>();
    for (const m of matches) {
        let lines = cache.get(m.path);
        if (!lines) {
            try { lines = (await ctx.fns.files.read({ path: m.path })).replaceAll("\r\n", "\n").split("\n"); }
            catch { lines = []; }
            cache.set(m.path, lines);
        }
        const from = Math.max(0, m.line - 1 - context);
        const to = Math.min(lines.length, m.line + context);
        (m as any).before = lines.slice(from, m.line - 1);
        (m as any).after = lines.slice(m.line, to);
    }
}

async function isDir(path: string): Promise<boolean> {
    try { return (await import("node:fs/promises")).stat(path).then(st => st.isDirectory()); }
    catch { return false; }
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
