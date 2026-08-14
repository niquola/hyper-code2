// Create an event (WRITE — modifies the calendar).
// ctx.fns.gcal.create({ summary, start, end, description?, location?, attendees?, calendarId?, account? })
//   start/end accept:
//     "14:00"               -> today at 14:00 (local TZ)
//     "2026-06-10"          -> all-day event
//     "2026-06-10 14:00"    -> specific datetime (local TZ)
//     full ISO string       -> used as-is
//   attendees : array of email strings.
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
 * Create a Google Calendar event.
 *
 * @param opts - Options for the operation.
 * @param opts.summary - Event or document summary/title.
 * @param opts.start - Event start date/time.
 * @param opts.end - Event end date/time.
 * @param opts.description - Event description.
 * @param opts.location - Event location.
 * @param opts.attendees - Event attendee email addresses or attendee objects.
 * @param opts.calendarId - Calendar identifier; defaults to the primary calendar where supported.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: { summary: string; start: string; end: string; description?: string; location?: string; attendees?: string[]; calendarId?: string; account?: string },
) {
    if (!opts?.summary || !opts?.start || !opts?.end) throw new Error("gcal.create requires { summary, start, end }");
    const calendarId = opts.calendarId ?? "primary";
    const event: any = { summary: opts.summary, start: parseDateTime(opts.start), end: parseDateTime(opts.end) };
    if (opts.description) event.description = opts.description;
    if (opts.location) event.location = opts.location;
    if (opts.attendees?.length) event.attendees = opts.attendees.map(email => ({ email }));

    const result = await ctx.fns.gcal.api({
        path: `/calendars/${encodeURIComponent(calendarId)}/events`,
        method: "POST",
        body: event,
        account: opts.account,
    });
    return { id: result.id, summary: result.summary, start: result.start?.dateTime || result.start?.date, end: result.end?.dateTime || result.end?.date, htmlLink: result.htmlLink };
}
