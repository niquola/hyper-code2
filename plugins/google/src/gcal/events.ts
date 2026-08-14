// List/search events in a time range (singleEvents expansion, ordered by start).
// ctx.fns.gcal.events({ from?, to?, days?, q?, calendarId?, max?, account? })
//   from/to : ISO datetimes (timeMin/timeMax). Defaults: from = now, to = from + days.
//   days    : window size in days when `to` is omitted (default 7). Use days<0 for the past.
//   q       : free-text search across event fields.
//   calendarId : default "primary".
function mapEvent(e: any) {
    const self = e.attendees?.find((a: any) => a.self === true);
    return {
        id: e.id,
        summary: e.summary || "(no title)",
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        allDay: !!e.start?.date,
        location: e.location,
        description: e.description,
        status: e.status,
        htmlLink: e.htmlLink,
        hangoutLink: e.hangoutLink,
        organizer: e.organizer?.email,
        responseStatus: self?.responseStatus,
        attendees: e.attendees?.map((a: any) => ({
            email: a.email,
            responseStatus: a.responseStatus,
            ...(a.organizer ? { organizer: true } : {}),
            ...(a.self ? { self: true } : {}),
        })),
    };
}

/**
 * List Google Calendar events.
 *
 * @param opts - Options for the operation.
 * @param opts.from - Sender address or filter criterion.
 * @param opts.to - Recipient address or addresses.
 * @param opts.days - Number of days in the query window.
 * @param opts.q - Alias for `query`.
 * @param opts.calendarId - Calendar identifier; defaults to the primary calendar where supported.
 * @param opts.max - Maximum number of results to return.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts?: { from?: string; to?: string; days?: number; q?: string; calendarId?: string; max?: number; account?: string },
) {
    const days = opts?.days ?? 7;
    const fromDate = opts?.from ? new Date(opts.from) : new Date();
    const toDate = opts?.to ? new Date(opts.to) : new Date(fromDate.getTime() + days * 24 * 60 * 60 * 1000);
    const timeMin = days < 0 && !opts?.to ? toDate : fromDate;
    const timeMax = days < 0 && !opts?.to ? fromDate : toDate;

    const calendarId = opts?.calendarId ?? "primary";
    const result = await ctx.fns.gcal.api({
        path: `/calendars/${encodeURIComponent(calendarId)}/events`,
        query: {
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
            maxResults: opts?.max ?? 50,
            q: opts?.q,
        },
        account: opts?.account,
    });
    return (result.items || []).map(mapEvent);
}
