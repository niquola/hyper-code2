// Move the workspace's pointer to something and light it up, without touching
// it. This is how the user is shown where to look before anything happens.
//   page.point({ entity: "questionnaire", id: "phq9" })
//   page.point({ action: "materialize" })
//   page.point({ form: "qr-search", field: "q" })
export default async function (ctx: Context, _session: Session | null, opts: types.screen.Descriptor & { delay?: number; holdMs?: number }) {
    return await ctx.fns.screen.eval({ code: `return await window.page.point(${JSON.stringify(opts)})` });
}
