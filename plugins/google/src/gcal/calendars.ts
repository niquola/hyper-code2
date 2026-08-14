// List calendars the account can access (calendarList).
// ctx.fns.gcal.calendars({ account? })
/**
 * List calendars.
 *
 * @param opts - Options for the operation.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts?: { account?: string }) {
    const result = await ctx.fns.gcal.api({ path: "/users/me/calendarList", query: { maxResults: 250 }, account: opts?.account });
    return (result.items || []).map((c: any) => ({
        id: c.id,
        summary: c.summary,
        description: c.description,
        primary: c.primary ?? false,
        accessRole: c.accessRole,
        timeZone: c.timeZone,
        backgroundColor: c.backgroundColor,
        selected: c.selected,
    }));
}
