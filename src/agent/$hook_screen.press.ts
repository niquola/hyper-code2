// The person answered a live tour step (screen's `screen.press` point) — put
// one line of fact into the CURRENT agent's queue, so the guide's next turn is
// their next move. No current agent → the press dissolves (a tour with no
// guide has nobody to tell).
export default async function (ctx: Context, _session: Session | null, opts: { pressed: string; say: string; stuck?: string; url: string; at: string }) {
    // The tab that raised the keypress says which agent it is showing; falling
    // back to a server-global "current agent" delivered presses to whatever
    // someone else had open.
    const id = (await ctx.fns.ui.state({}))?.agentId ?? (await ctx.fns.session.list({}))[0]?.id;
    if (!id) return;
    const what = opts.pressed === 'did-it' ? 'pressed the lit control themselves'
        : opts.pressed === 'failed' ? `could not do it${opts.stuck ? ` — looked for ${opts.stuck}` : ''}`
        : `pressed ${opts.pressed}`;
    await ctx.fns.session.appendUserMessage({
        id,
        text: `[tour] The user ${what} on step "${opts.say}" (${opts.url}) — your move`,
    });
    await ctx.fns.procs.db.run({
        sql: 'UPDATE agents SET next_run_at = GREATEST(COALESCE(next_run_at, 0), ?) WHERE id = ?',
        params: [Date.now(), id],
    });
    ctx.fns.agent.wakeWorker({});
}
