// POST /ui/chat-width — persist the user's preferred chat width in server kv.
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }) {
    const body: any = await opts.req.json().catch(() => ({}));
    const width = Math.round(Number(body.width));
    if (!Number.isFinite(width) || width < 280 || width > 3000) return new Response("invalid width", { status: 400 });
    await ctx.fns.procs.db.run({
        sql: `INSERT INTO kv (key, value) VALUES (?, ?)
              ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        params: ["ui:chatWidth", String(width)],
    });
    return Response.json({ ok: true, width });
}
