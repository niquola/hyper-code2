// Wrap a handler's return value into a Response (shared by the server and by
// http.dispatch):
//   Response              → passthrough
//   string                → HTML via ctx.fns.procs.ui.layout({ main })
//   { main, title?, ... } → HTML via layoutOf(ctx)!(ctx, session, opts)   (status honored)
//   other                 → JSON
//
// An htmx request gets the page fragment instead of the whole document, plus
// whatever chrome the host keeps in step with it — see `chrome` below.
export default async function (ctx: Context, session: Session | null, opts: { value: any }): Promise<Response> {
    const v = opts.value;
    if (v instanceof Response) return v;
    if (typeof v === "string" && layoutOf(ctx)) {
        return page(ctx, session, { main: v });
    }
    if (v && typeof v === "object" && typeof v.main === "string" && layoutOf(ctx)) {
        const { status, ...rest } = v;
        return page(ctx, session, rest, status ?? 200);
    }
    return new Response(JSON.stringify(v ?? null), {
        status: 200,
        headers: { "content-type": "application/json" },
    });
}

async function page(ctx: Context, session: Session | null, opts: any, status = 200): Promise<Response> {
    // A history restore (Back/Forward with no local cache) also arrives with
    // HX-Request, but htmx replaces the whole body with the answer — it must be
    // the full document, not a fragment.
    const partial = session?.req?.headers.get("hx-request") === "true"
        && session?.req?.headers.get("hx-history-restore-request") !== "true";
    const dressed = { ...opts, main: await pane(ctx, session, opts) };
    const body = partial ? dressed.main + chrome(ctx, session) : await layoutOf(ctx)!(ctx, session, dressed);
    return new Response(body, { status, headers: html() });
}

// A layout of the second level: the module's own. A host owns the window — the
// rail, the tab strip, the login — but a module that is several pages deep owns
// the navigation *between those pages*, and it cannot live in the host or every
// host would have to know it.
//
// So: a module shipping `<its name>/pane.ts` has it wrap the `main` of the routes
// under `/<its name>`, and nothing else's. The pages themselves are untouched —
// they return `{ title, main }` as before — which is the point: the navigation is
// added in one place instead of by twelve routes remembering to call a wrapper.
// It runs on the whole-document path and on the htmx fragment alike, so a swap
// into `#main` brings the module's own chrome with it.
//
// A handler that returns a `Response` of its own (the fragment a POST answers a
// section with) never comes through here, which is right: that swaps into a
// target inside the page, not over it.
async function pane(ctx: Context, session: Session | null, opts: any): Promise<string> {
    const ns = (session?.url?.pathname ?? "").split("/")[1];
    const own = ns ? (ctx.state.registry as any)?.[ns]?.pane : null;
    if (typeof own !== "function") return opts.main;
    try { return (await own(ctx, session, { ...opts, path: session?.url?.pathname ?? "/" })) ?? opts.main; }
    catch (error: any) { console.warn(`[pane] ${ns}: ${String(error?.message ?? error)}`); return opts.main; }
}

// The seam a host uses to keep the parts of a page that live *outside* the
// swapped fragment in step with it — a tab strip, a patient band, a breadcrumb.
// htmx replaces one element, so everything else that must change rides along
// with `hx-swap-oob`, and the framework should not know what those things are.
//
// Read straight off the hook map rather than through `hooks.run`, because this
// is on the hot path of every response and drawing a fragment is pure: a handler
// that needed to await something would mean promoting `toResponse`, not this. A
// host with no chrome registers nothing and pays nothing.
function chrome(ctx: Context, session: Session | null): string {
    const handlers = ctx.state.procs?.hooks?.handlers?.["procs.ui.chrome"];
    if (!handlers) return "";
    const path = session?.url?.pathname ?? "/";
    let out = "";
    for (const handler of handlers.values()) {
        try { out += handler(ctx, session, { path, oob: true }) ?? ""; }
        catch (error: any) { console.warn(`[chrome] ${String(error?.message ?? error)}`); }
    }
    return out;
}

function html() {
    return { "content-type": "text/html; charset=utf-8" };
}

// A page needs a shell to go in. The framework ships `procs/ui/layout.ts`; an app
// replaces it by shipping its own `ui/layout.ts` — an EXPLICIT seam, since the
// two live under different names and nothing silently overwrites anything. A
// process with neither still answers, with the value as JSON.
function layoutOf(ctx: Context): Function | null {
    const reg = ctx.state.registry as any;
    return reg?.ui?.layout ?? reg?.procs?.ui?.layout ?? null;
}
