// Close named background tabs created for one task. Prefix mode is convenient
// for research, whose tabs are `<base>-search` and `<base>-page-N`.
/**
 * Closes browser sessions selected by name or prefix.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
  /** Exact logical session names to close. */
  sessions?: string[];
  /** Session-name prefix to close. */
  prefix?: string },
): Promise<{ closed: string[] }> {
    const map: Map<string, any> = (ctx.state as any).cdp?.sessions ?? new Map();
    const names = opts.sessions?.length
        ? opts.sessions
        : [...map.keys()].filter(name => opts.prefix && name.startsWith(opts.prefix));
    if (!names.length) return { closed: [] };
    const closed: string[] = [];
    for (const name of names) {
        if (!map.has(name)) continue;
        await ctx.fns.browser.tabClose({ session: name });
        closed.push(name);
    }
    return { closed };
}
