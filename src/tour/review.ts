// Read a tour without playing one — the same steps `page.tour` would hand to a
// browser, checked against the pages they name, in this process.
//
//   ctx.fns.tour.review({ steps: [ … ] })
//   → { start: "/ehr", steps: [{ n: 1, url: "/ehr", say: "…", target: "patient:anna", on: "screen" }, …],
//       missed: ["/ehr/inbox", "/ehr/orders"] }
//
// The complaint it answers is not that tours break — the player is tested — it
// is that a tour is only found to be wrong after the app it is about has been
// built, half an hour later, by taking it. Two of the three ways a tour is wrong
// can be read off the steps themselves:
//
//   `on`      whether the step's target is on the page that step is standing on
//             — `screen`, `elsewhere` (the page has no such thing), `nothing`
//             (the step names nothing at all, so it is a paragraph with a Next
//             button), or `missing` (the page itself did not answer).
//   `missed`  the pages of the project nobody is ever taken to. A tour that
//             shows a third of the product looks fine step by step; this is the
//             line that says so.
//
// The third — whether the sentences are any good — is still a person's, and
// this is what makes that judgement cheap: the steps come back numbered, so
// "fix the fourth" is a thing that can be said.
//
// **No browser.** A step's page is the one it opened on the way in, and the
// cursor follows a click through the link it lands on, so the whole walk is
// `http.dispatch` — the same path a request takes, minus the socket.
/**
 * Reviews tour targets and route coverage without driving a browser.
 * @param opts.steps Ordered tour steps to inspect.
 * @param opts.url Initial route used before a step opens another route.
 */
export default async function (ctx: Context, _session: Session | null, opts: { steps: types.tour.Step[]; url?: string }) {
    const steps = (opts.steps ?? []).filter(Boolean);
    if (!steps.length) throw new Error("a tour needs steps");

    let url = opts.url ?? "/";
    const visited: string[] = [];
    const reviewed = [];
    for (const [i, step] of steps.entries()) {
        const opened = opens(step);
        if (opened) url = opened;
        visited.push(url);

        const page = await read(ctx, url);
        const want = targets(step);
        const found = page.markers && want ? page.markers.find(marker => matches(ctx, marker, want)) : null;
        reviewed.push({
            n: i + 1,
            url,
            say: step.say ?? "",
            target: want ? name(want) : "",
            on: !page.markers ? `missing (${page.status})` : !want ? "nothing" : found ? "screen" : "elsewhere",
        });
        // A step that clicks a link leaves the page it was on, so the next
        // sentence is read somewhere else — follow it, or every step after the
        // first click is checked against a page nobody is looking at any more.
        if (step.click && found?.href) url = found.href;
    }

    return { start: reviewed[0]!.url, steps: reviewed, missed: await missed(ctx, visited) };
}

// The page as this process renders it — asked for as a browser would, so the
// layout runs and the whole document comes back.
async function read(ctx: Context, url: string): Promise<{ status: number; markers: Marker[] | null }> {
    const res = await ctx.fns.procs.http.dispatch({ url, headers: { accept: "text/html" } }).catch(() => null);
    if (!res || !res.ok) return { status: res?.status ?? 0, markers: null };
    return { status: res.status, markers: await markers(await res.text()) };
}

// Every marked control on the page, in the vocabulary the tour addresses things
// by — `ui.attr`'s own data-* keys, read with Bun's parser rather than a regex
// because an entity's link is usually the `<a>` inside it, not the tag itself.
async function markers(html: string): Promise<Marker[]> {
    const all: Marker[] = [];
    const open: Marker[] = [];
    await new HTMLRewriter()
        .on("[data-entity],[data-action],[data-role],[data-form],[data-field],[data-page]", {
            element(el) {
                const marker: Marker = { href: el.getAttribute("href") };
                for (const key of KEYS) {
                    const value = el.getAttribute(`data-${key}`);
                    if (value !== null) marker[key] = value;
                }
                all.push(marker);
                if (VOID.has(el.tagName)) return;   // a void element has no end tag to hang a pop on
                open.push(marker);
                el.onEndTag(() => { open.pop(); });
            },
        })
        .on("a[href]", {
            element(el) {
                const inside = open[open.length - 1];
                if (inside && !inside.href) inside.href = el.getAttribute("href");
            },
        })
        .transform(new Response(html)).text();
    return all;
}

// What this step points at, in the order the resolver takes it: the thing it
// clicks, the thing it points at, the form it fills or submits, and last the
// step's own markers — a step that says `entity`+`id` with no verb still lights
// something up.
function targets(step: types.tour.Step): types.screen.Descriptor | null {
    if (step.click) return step.click;
    if (step.point) return step.point;
    if (step.fill) return { form: step.fill.form };
    if (step.submit) return { form: step.submit };
    const own = Object.fromEntries(KEYS.filter(key => (step as any)[key]).map(key => [key, (step as any)[key]]));
    return Object.keys(own).length ? own : null;
}

// A marker answers a descriptor when it carries every key the descriptor names
// — `ui.attr` puts them on one tag, so one tag is where they are looked for.
// Values are compared as they were written into the markup, which is escaped.
function matches(ctx: Context, marker: Marker, want: types.screen.Descriptor): boolean {
    return Object.entries(want).every(([key, value]) =>
        value === undefined || value === ""
        || marker[key as (typeof KEYS)[number]] === ctx.fns.procs.ui.escape({ text: String(value) }));
}

function name(want: types.screen.Descriptor): string {
    return Object.entries(want).filter(([, v]) => v).map(([k, v]) => (k === "id" ? v : `${k}:${v}`)).join("/");
}

// The pages of the project that no step ever stood on. The project is the
// folder this process was started to work on, so its own route files are the
// product — nothing of the host's, nothing of the framework's — and a page with
// a parameter counts as reached the moment one of its instances is.
async function missed(ctx: Context, visited: string[]): Promise<string[]> {
    const workdir = ctx.fns.procs.project.workdir({});
    const entries: any[] = await ctx.fns.procs.project.scan({});
    const pages = entries
        .filter(entry => entry.kind === "route" && entry.method === "GET" && entry.rootDir?.startsWith(workdir))
        .map(entry => entry.routePath);

    const reached = new Set(visited.map(url =>
        ctx.fns.procs.http.match({ method: "GET", pathname: new URL(url, "http://localhost").pathname })?.path));
    return [...new Set(pages)].filter(path => !reached.has(path)).sort();
}

const KEYS = ["page", "section", "entity", "id", "status", "role", "form", "action", "field"] as const;
const VOID = new Set(["input", "img", "br", "hr", "meta", "link", "source", "area", "col", "embed", "track", "wbr"]);

type Marker = { href: string | null } & Partial<Record<(typeof KEYS)[number], string>>;

// A step's page is the one it opened on the way in. `open` is either a url or
// something on the screen whose own link is followed — and the second is only
// answerable from the page in hand, so it is left to the click that follows it.
function opens(step: types.tour.Step): string | null {
    if (typeof step.open === "string") return step.open;
    return step.open?.url ?? null;
}
