// Patch an existing event (WRITE — modifies the calendar).
// ctx.fns.gcal.update({ id, summary?, start?, end?, description?, location?, calendarId?, account? })
// Only the provided fields are changed (PATCH). start/end use the same formats as gcal.create.
function parseDateTime(str: string): { dateTime?: string; date?: string; timeZone?: string } {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (/^\d{1,2}:\d{2}$/.test(str)) {
        const today = new Date();
        const [h, m] = str.split(":").map(Number);
        today.setHours(h!, m!, 0, 0);
        return { dateTime: today.toISOString(), timeZone: tz };
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return { date: str };
    }
    const d = new Date(str.replace(" ", "T"));
    return { dateTime: d.toISOString(), timeZone: tz };
}

/**
 * Update a Google Calendar event.
 *
 * @param opts - Options for the operation.
 * @param opts.id - Resource identifier.
 * @param opts.summary - Event or document summary/title.
 * @param opts.start - Event start date/time.
 * @param opts.end - Event end date/time.
 * @param opts.description - Event description.
 * @param opts.location - Event location.
 * @param opts.calendarId - Calendar identifier; defaults to the primary calendar where supported.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: { id: string; summary?: string; start?: string; end?: string; description?: string; location?: string; calendarId?: string; account?: string },
) {
    if (!opts?.id) throw new Error("gcal.update requires { id }");
    const calendarId = opts.calendarId ?? "primary";
    const patch: any = {};
    if (opts.summary !== undefined) patch.summary = opts.summary;
    if (opts.description !== undefined) patch.description = opts.description;
    if (opts.location !== undefined) patch.location = opts.location;
    if (opts.start !== undefined) patch.start = parseDateTime(opts.start);
    if (opts.end !== undefined) patch.end = parseDateTime(opts.end);

    const result = await ctx.fns.gcal.api({
        path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(opts.id)}`,
        method: "PATCH",
        body: patch,
        account: opts.account,
    });
    return { id: result.id, summary: result.summary, start: result.start?.dateTime || result.start?.date, end: result.end?.dateTime || result.end?.date, htmlLink: result.htmlLink };
}
