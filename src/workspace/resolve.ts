import { resolve } from "node:path";

/** Resolves a path relative to the current workspace. */
export default function (
    _ctx: Context,
    session: Session | null,
    opts: { /** Workspace-relative path. */ path?: string },
): string {
    return resolve(session?.agent?.workspaceDir ?? process.cwd(), opts.path || ".");
}