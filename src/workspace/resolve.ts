import { resolve } from "node:path";

export default function (
    _ctx: Context,
    session: Session | null,
    opts: { path?: string },
): string {
    return resolve(session?.workspaceDir ?? process.cwd(), opts.path || ".");
}