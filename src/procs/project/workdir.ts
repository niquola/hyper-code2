import { resolve } from "node:path";
// project/modules calls this during bootstrap, before the registry exists, so the
// fallback goes through a direct import rather than ctx.fns.
import projectRoot from "../project/projectRoot";

// The working directory the workspace operates on — what the file manager
// lists and agents edit. WORKDIR wins; otherwise it is the project root.
// This is NOT where src/ and package.json are looked up (that is projectRoot).
/**
 * Returns the workspace directory used for file operations and agent edits.
 * `WORKDIR` takes precedence and supports `~/`; otherwise the project root is used.
 */
export default function (ctx: Context, session: Session | null, _opts?: {}): string {
    const fromEnv = ctx.env.WORKDIR;
    if (fromEnv) return resolve(expandHome(fromEnv));
    return projectRoot(ctx, session, {});
}

export function expandHome(path: string): string {
    return path.startsWith("~/") ? process.env.HOME + path.slice(1) : path;
}
