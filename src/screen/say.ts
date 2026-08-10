// Put a caption on the screen, anchored to whatever it is about. The pointer
// goes there too, so the sentence and the thing it describes are in the same
// place — which is the whole difference between a tour and a page that changes
// on its own.
//   page.say({ text: "This is the library search", form: "qr-search" })
//   page.say({ text: "and this is what it found", entity: "questionnaire", id: "44249-1" })
export default async function (ctx: Context, _session: Session | null, opts: types.screen.Descriptor & { text: string; ms?: number }) {
    return await ctx.fns.screen.eval({ code: `return await window.page.say(${JSON.stringify(opts)})` });
}
