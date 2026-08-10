// Submit the form at [data-form="<name>"] by pressing its own submit button, so
// validation, the named action and htmx all run exactly as they do for a person.
export default async function (ctx: Context, _session: Session | null, opts: { form: string; show?: boolean; settleMs?: number }) {
    const result = await ctx.fns.screen.eval({ code: `return await window.page.submit(${JSON.stringify(opts)})`, timeoutMs: 20_000 });
    await Bun.sleep(opts.settleMs ?? 120);   // the client waited for htmx; this is for paint
    return result;
}
