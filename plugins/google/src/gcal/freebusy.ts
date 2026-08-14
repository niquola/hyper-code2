// Query free/busy intervals for one or more calendars in a time range.
// ctx.fns.gcal.freebusy({ from?, to?, days?, calendars?, account? })
//   calendars : array of calendarIds (default ["primary"]).
//   from/to   : ISO datetimes; defaults from = now, to = from + days (default 7).
/**
 * Query free/busy information for calendars.
 *
 * @param opts - Options for the operation.
 * @param opts.from - Sender address or filter criterion.
 * @param opts.to - Recipient address or addresses.
 * @param opts.days - Number of days in the query window.
 * @param opts.calendars - Calendar IDs to query; defaults to the primary calendar.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts?: { from?: string; to?: string; days?: number; calendars?: string[]; account?: string },
) {
    const days = opts?.days ?? 7;
    const fromDate = opts?.from ? new Date(opts.from) : new Date();
    const toDate = opts?.to ? new Date(opts.to) : new Date(fromDate.getTime() + days * 24 * 60 * 60 * 1000);
    const ids = (opts?.calendars && opts.calendars.length ? opts.calendars : ["primary"]);

    const result = await ctx.fns.gcal.api({
        path: "/freeBusy",
        method: "POST",
        body: {
            timeMin: fromDate.toISOString(),
            timeMax: toDate.toISOString(),
            items: ids.map(id => ({ id })),
        },
        account: opts?.account,
    });
    const out: Record<string, { busy: { start: string; end: string }[]; errors?: any[] }> = {};
    for (const [id, cal] of Object.entries(result.calendars || {})) {
        out[id] = { busy: (cal as any).busy || [], ...((cal as any).errors ? { errors: (cal as any).errors } : {}) };
    }
    return out;
}
