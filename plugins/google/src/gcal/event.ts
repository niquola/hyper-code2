// Get a single event by id.
// ctx.fns.gcal.event({ id, calendarId?, account? })
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

export default async function (ctx: Context, session: Session | null, opts: { id: string; calendarId?: string; account?: string }) {
    if (!opts?.id) throw new Error("gcal.event requires { id }");
    const calendarId = opts.calendarId ?? "primary";
    const result = await ctx.fns.gcal.api({
        path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(opts.id)}`,
        account: opts.account,
    });
    return mapEvent(result);
}
