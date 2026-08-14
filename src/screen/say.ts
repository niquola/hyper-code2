// Put a caption on the screen, anchored to whatever it is about. The pointer
// goes there too, so the sentence and the thing it describes are in the same
// place — which is the whole difference between a tour and a page that changes
// on its own.
//   page.say({ text: "This is the library search", form: "qr-search" })
//   page.say({ text: "and this is what it found", entity: "questionnaire", id: "44249-1" })
/**
 * Displays an anchored explanatory caption in the browser.
 * @param opts.entity Entity kind used to identify the UI element.
 * @param opts.id Prompt or UI entity identifier.
 * @param opts.action Action marker used to identify the UI control.
 * @param opts.form Stable form identifier.
 * @param opts.field Field marker used to identify the UI control.
 * @param opts.role Semantic role used to identify the UI element.
 * @param opts.section Named page section.
 * @param opts.text Caption text to display.
 * @param opts.ms Caption duration in milliseconds.
 */
export default async function (ctx: Context, _session: Session | null, opts: types.screen.Descriptor & { text: string; ms?: number }) {
    return await ctx.fns.screen.eval({ code: `return await window.page.say(${JSON.stringify(opts)})` });
}
