// The database location — resolved through the config system (defaults <
// package.json proc.prod.db < env DATABASE_URL). No import: the schema flows
// through ctx.state (the `import(...)` below is type-only and erased at runtime).
//
// A relative url is relative to WORKDIR, not to this repo: the transcript is the
// project's, so pointing the workspace at another project must not open the
// previous one's chat.
import { isAbsolute, resolve } from "node:path";

export default function (ctx: Context, _session: Session | null, _opts?: {}): string {
    const url = (ctx.fns.procs.config.resolve({ module: "procs/db" }) as ConfigOf<typeof import("./$config").default>).url;
    if (url === ":memory:" || isAbsolute(url)) return url;
    return resolve(ctx.fns.procs.project.workdir({}), url);
}
