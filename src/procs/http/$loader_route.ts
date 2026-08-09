// `<module>/$route_<path>_<METHOD>.ts` — a request handler. Ships with the
// framework the way a module's loader ships with a module: a row in the same
// table, handed all the route files at once.
import { bindSelf } from "../boot/load";

export default async function (ctx: Context, _session: Session | null, opts: { entries: any[] }): Promise<void> {
    const routes = (ctx.state.procs.http.routes ??= {});
    for (const entry of opts.entries) {
        const handler = entry.fn ?? (await import(entry.abs + `?t=${Date.now()}`)).default;
        if (typeof handler !== "function") { console.warn(`[routes] skip (no default export): ${entry.root}/${entry.rel}`); continue; }
        // Two containers, one address. It used to be last-scanned-wins in
        // silence, which was harmless while every namespace belonged to exactly
        // one container — and stops being harmless the moment a project writes
        // pages into a host's url space (`src/ehr/patient/$id/…`): a project
        // whose folder happens to be called `orders` would replace the EHR's own
        // page and nothing would say so. The first registration keeps the
        // address; the second is refused, by name, with both files in the
        // message.
        const from = `${entry.root}/${entry.rel}`;
        const taken = routes[entry.routePath]?.[entry.method] as (Function & { from?: string }) | undefined;
        // …with one exception, and it is the documented one: an app replaces the
        // framework's own route by shipping the same address (`src/$route__GET.ts`
        // over `procs`'s). So core loses to anybody, in either scan order — a
        // reload rescans and would otherwise take the route back — and two
        // containers that are both somebody's app are the collision.
        if (taken?.from && taken.from !== from) {
            const core = (path: string) => path.startsWith("core/");
            if (core(from)) continue;                       // core never displaces an app
            if (!core(taken.from)) {
                console.error(`[routes] ${entry.method} ${entry.routePath} is already ${taken.from} — ${from} is refused (two containers, one address)`);
                continue;
            }
        }
        // **One position, one name.** `/ehr/patient/:patientId/…` and
        // `/ehr/patient/:id/…` are the same segment called two things, and the
        // cost is invisible: a middleware that reads `params.patientId` — the
        // way the EHR reads who a page is about — simply finds nothing, so the
        // page renders with no patient badge, no sections, and no error. Whoever
        // named that position first owns the name; the second spelling is
        // refused here rather than found by a person wondering where the badge
        // went.
        const clash = nameClash(routes, entry.routePath);
        if (clash) {
            console.error(`[routes] ${entry.method} ${entry.routePath} — ${clash} (one position, one parameter name); ${from} is refused`);
            continue;
        }
        // A route of a tree mounted under a prefix calls its own functions the
        // way its source is written — `ctx.fns.app.*` — so it gets the same
        // self-aware ctx.
        const bound = Object.assign(bindSelf(handler, entry.namespace), { from });
        (routes[entry.routePath] ??= {})[entry.method] = bound;
        ctx.fns.procs.log.debug({ event: "load.route", msg: `${entry.method} ${entry.routePath}`, from });
    }
}

// Does this path name a segment somebody else already named differently? Only
// the literal prefix counts as "the same position": `/ehr/patient/:x` and
// `/apps/:x` are different places and may of course differ. Returns the sentence
// to print, or null when the table stays consistent.
function nameClash(routes: Record<string, any>, path: string): string | null {
    const mine = path.split("/");
    for (const other of Object.keys(routes)) {
        const theirs = other.split("/");
        for (let i = 0; i < Math.min(mine.length, theirs.length); i++) {
            const [a, b] = [mine[i]!, theirs[i]!];
            if (a === b) continue;
            // The first difference decides: two params here is the clash, and
            // anything else is simply a different path from here on.
            return a.startsWith(":") && b.startsWith(":")
                ? `${other} calls that segment ${b}, this one calls it ${a}`
                : null;
        }
    }
    return null;
}
