import { resolve } from "node:path";

// Resolve `path` to an absolute path against the workspace root (cwd).
// Relative paths resolve under cwd; absolute paths pass through unchanged;
// empty path == cwd.
//
// NOTE: the previous workspace-confinement guard (it threw "outside workspace"
// for any path that escaped cwd) was removed by request — files.* may now read
// and write anywhere the process has permission, including ../ siblings and
// absolute paths like /tmp or /Users/.../.claude. This deliberately
// de-sandboxes the agent's file tools; only run agents you trust on this build.
export default function (_ctx: Context, opts: { path: string }): string {
    return resolve(process.cwd(), opts.path || ".");
}
