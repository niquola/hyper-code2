// Open something in the right pane. Either a URL — the plugin pages carry their
// whole state in one (`/questionnaire?q=tobacco`), which is the shortest way to
// put the user in front of something — or an entity, whose own link is followed.
//
// Navigation stays partial: htmx swaps the pane and pushes the URL, so the chat,
// the event stream and this bridge stay alive. A full reload drops all three.
//
// **What comes back is what they are now looking at.** Opening a page and asking
// what is on it were two calls, and the second one is the one that gets
// forgotten — so an agent says "here is the list" about a page it never read,
// and an empty one looks exactly like a full one from where it is standing. The
// read is the same `readScreen` — every entity, action, form and notice, off the
// `data-*` markers the kit puts on — and it costs a round trip that was going to
// be made anyway. `read: false` for the rare case where the answer cannot matter.
export default async function (ctx: Context, _session: Session | null, opts: { url?: string } & types.screen.Descriptor & { show?: boolean; settleMs?: number; read?: boolean }) {
    const verb = opts.url ? "go" : "open";
    const result: any = await ctx.fns.screen.eval({ code: `return await window.page.${verb}(${JSON.stringify(opts)})`, timeoutMs: 20_000 });
    await Bun.sleep(opts.settleMs ?? 120);   // the swap is already done — this is for paint
    if (opts.read === false) return result;

    // A tab that navigated on, closed, or answered slowly is not an error to
    // raise here: the opening itself succeeded, which is what was asked for.
    const screen = await ctx.fns.screen.readScreen({}).catch(() => null);
    return screen ? { ...(result ?? {}), screen } : result;
}
