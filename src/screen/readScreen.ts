// What is on the screen right now, in the vocabulary this process can act on:
// the page, the entities, the actions and the forms with their fields. The
// catalogue is built by the same resolver the verbs use, so anything reported
// here can be pointed at, clicked or filled — and anything missing from it
// cannot. Ask this before acting instead of guessing at names.
//
// (A verb, not a noun: `State.ts` beside it is the module's own state type, and
// on a case-insensitive filesystem `state.ts` would BE that file.)
/**
 * Reads structured state from the connected browser screen.
 * @param opts.scope Page region to inspect.
 * @param opts.text Text input or whether screen text should be included.
 * @param opts.maxText Maximum returned text length.
 */
export default async function (ctx: Context, _session: Session | null, opts: { scope?: "main" | "chat" | "body"; text?: boolean; maxText?: number } = {}) {
    return await ctx.fns.screen.eval({ code: `return window.page.state(${JSON.stringify(opts)})` });
}
