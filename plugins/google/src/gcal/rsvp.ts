// Respond to an event invite (WRITE — sets your attendee responseStatus).
// ctx.fns.gcal.rsvp({ id, status, calendarId?, account? })
//   status : "accepted" | "declined" | "tentative"
export default async function (
    ctx: Context,
    session: Session | null,
    opts: { id: string; status: "accepted" | "declined" | "tentative"; calendarId?: string; account?: string },
) {
    if (!opts?.id) throw new Error("gcal.rsvp requires { id }");
    if (!["accepted", "declined", "tentative"].includes(opts.status)) {
        throw new Error("gcal.rsvp status must be: accepted | declined | tentative");
    }
    const calendarId = opts.calendarId ?? "primary";
    const path = `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(opts.id)}`;
    const event = await ctx.fns.gcal.api({ path, account: opts.account });
    const attendees = event.attendees || [];
    let found = false;
    for (const a of attendees) {
        if (a.self) { a.responseStatus = opts.status; found = true; break; }
    }
    if (!found) throw new Error(`No 'self' attendee on event ${opts.id} — cannot RSVP`);
    const result = await ctx.fns.gcal.api({ path, method: "PATCH", body: { attendees }, account: opts.account });
    const self = result.attendees?.find((a: any) => a.self === true);
    return { id: result.id, summary: result.summary, responseStatus: self?.responseStatus };
}
