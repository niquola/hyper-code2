// What is on the screen right now, in the vocabulary the workspace can act on:
// the page, the entities, the actions and the forms with their fields. The
// catalogue is built by the same resolver the verbs use, so anything reported
// here can be pointed at, clicked or filled — and anything missing from it
// cannot. Ask this before acting instead of guessing at names.
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    return await ctx.fns.screen.eval({ code: "return window.page.state()" });
}
