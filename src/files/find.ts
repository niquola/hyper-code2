// Find files by glob. ripgrep's `--files` walk does it while honouring
// .gitignore and skipping the directories nobody means to search; without rg
// the fallback is Bun.Glob with a hand-written skip list.
//
// This exists because the alternative was `bash find ~ -name …`, which walks
// every node_modules on the machine and gets killed by a timeout before it
// reaches anything interesting. A search that answers in a second beats a
// search that is technically more general.
import { relative } from "node:path";

/** Finds workspace files matching a glob pattern. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { /** Glob or search pattern. */ pattern: string; /** Workspace-relative path. */ path?: string; /** Maximum number of results. */ limit?: number; /** Whether to include ignored files. */ noIgnore?: boolean; /** Whether to include hidden paths. */ hidden?: boolean; /** Timeout in seconds. */ timeout?: number },
): Promise<string[]> {
    const root = ctx.fns.files.resolveSafe({ path: "" });
    const abs = ctx.fns.files.resolveSafe({ path: opts.path ?? "" });
    const rel = relative(root, abs);
    const target = rel === "" ? "." : rel.startsWith("..") ? abs : rel;
    const limit = Math.max(1, opts.limit ?? 200);
    const pattern = String(opts.pattern ?? "*");

    const rg = ctx.fns.files.rgPath({});
    if (!rg) {
        const out: string[] = [];
        const skip = /(^|\/)(node_modules|\.git|\.runtime|dist|build)(\/|$)/;
        const prefix = target === "." ? "" : `${target}/`;
        for await (const found of new Bun.Glob(pattern.includes("/") ? pattern : `**/${pattern}`).scan({ cwd: abs, onlyFiles: true })) {
            if (skip.test(found)) continue;
            out.push(prefix + found);
            if (out.length >= limit) break;
        }
        return out;
    }

    // The pattern is applied HERE, not passed to rg as --glob: an explicit
    // include glob overrides .gitignore in ripgrep, so `find ignored.txt` would
    // cheerfully return the file the project asked us to ignore. rg walks, we
    // filter.
    const glob = new Bun.Glob(pattern.includes("/") ? pattern : `**/${pattern}`);
    const args = ["--files", "--no-require-git"];
    if (opts.noIgnore) args.push("--no-ignore");
    if (opts.hidden) args.push("--hidden");
    args.push("--", target);

    const proc = Bun.spawn({ cmd: [rg, ...args], cwd: root, stdout: "pipe", stderr: "pipe" });
    // A walk over an unbounded tree is exactly where a search hangs, so it gets
    // a deadline of its own and returns what it found by then.
    const seconds = Number(opts.timeout);
    const timer = Number.isFinite(seconds) && seconds > 0
        ? setTimeout(() => proc.kill(9), seconds * 1000)
        : null;

    const out: string[] = [];
    const decoder = new TextDecoder();
    let buf = "";
    outer: for await (const chunk of proc.stdout as ReadableStream<Uint8Array>) {
        buf += decoder.decode(chunk, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).replace(/^\.\//, "");
            buf = buf.slice(nl + 1);
            if (line && glob.match(line)) out.push(line);
            if (out.length >= limit) { proc.kill(9); break outer; }
        }
    }
    if (timer) clearTimeout(timer);
    return out;
}
