// Delete an event (WRITE — removes it from the calendar).
// ctx.fns.gcal.del({ id, calendarId?, account? })
/**
 * Delete a Google Calendar event.
 *
 * @param opts - Options for the operation.
 * @param opts.id - Resource identifier.
 * @param opts.calendarId - Calendar identifier; defaults to the primary calendar where supported.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts: { id: string; calendarId?: string; account?: string }) {
    if (!opts?.id) throw new Error("gcal.del requires { id }");
    const calendarId = opts.calendarId ?? "primary";
    await ctx.fns.gcal.api({
        path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(opts.id)}`,
        method: "DELETE",
        account: opts.account,
    });
    return { deleted: opts.id };
}
