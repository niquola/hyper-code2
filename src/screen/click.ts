// Click by the data-* convention, never by a CSS selector — a restyle must not
// break this. The pointer flies to the control and the control flashes first,
// so a person watching sees what was pressed; pass `show: false` to skip that.
//   page.click({ action: "materialize" })
//   page.click({ action: "turn-off", entity: "plugin", id: "questionnaire" })
//   page.click({ entity: "questionnaire", id: "phq9" })   // the row itself
export default async function (ctx: Context, _session: Session | null, opts: types.screen.Descriptor & { show?: boolean; delay?: number; settleMs?: number }) {
    const hit = await ctx.fns.screen.eval({ code: `return await window.page.click(${JSON.stringify(opts)})`, timeoutMs: 20_000 });
    await Bun.sleep(opts.settleMs ?? 120);   // the client waited for htmx; this is for paint
    return hit;
}
