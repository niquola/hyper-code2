// Click by the data-* convention, never by a CSS selector — a restyle must not
// break this. The pointer flies to the control and the control flashes first,
// so a person watching sees what was pressed; pass `show: false` to skip that.
//   page.click({ action: "materialize" })
//   page.click({ action: "turn-off", entity: "plugin", id: "questionnaire" })
//   page.click({ entity: "questionnaire", id: "phq9" })   // the row itself
/**
 * Clicks a UI element identified by stable data attributes.
 * @param opts.entity Entity kind used to identify the UI element.
 * @param opts.id Prompt or UI entity identifier.
 * @param opts.action Action marker used to identify the UI control.
 * @param opts.form Stable form identifier.
 * @param opts.field Field marker used to identify the UI control.
 * @param opts.role Semantic role used to identify the UI element.
 * @param opts.section Named page section.
 * @param opts.show Whether to animate the click.
 * @param opts.delay Delay before clicking in milliseconds.
 * @param opts.settleMs Post-click paint delay in milliseconds.
 */
export default async function (ctx: Context, _session: Session | null, opts: types.screen.Descriptor & { show?: boolean; delay?: number; settleMs?: number }) {
    const hit = await ctx.fns.screen.eval({ code: `return await window.page.click(${JSON.stringify(opts)})`, timeoutMs: 20_000 });
    await Bun.sleep(opts.settleMs ?? 120);   // the client waited for htmx; this is for paint
    return hit;
}
