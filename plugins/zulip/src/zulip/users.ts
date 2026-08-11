// List users (members) of a Zulip instance, optionally only those subscribed to
// a given channel. Without `channel` → all org members. With `channel` → fetch
// the stream's subscriber ids and filter the member list.
//   ctx.fns.zulip.users({ instance: "fhir" })
//   ctx.fns.zulip.users({ channel: "implementers", instance: "fhir" })
// → [{ id, email, name, isBot, isActive }]
export default async function (ctx: Context, session: Session | null, opts?: { channel?: string; instance?: string }) {
    const instance = opts?.instance;
    const data = await ctx.fns.zulip.api({ path: "/users", instance });
    const all = (data.members || []).map((m: any) => ({
        id: m.user_id,
        email: m.email,
        name: m.full_name,
        isBot: m.is_bot || false,
        isActive: m.is_active || false,
    }));

    if (!opts?.channel) return all;

    const channels = await ctx.fns.zulip.channels({ instance });
    const ch = channels.find((c: any) => c.name.toLowerCase() === opts.channel!.toLowerCase());
    if (!ch) throw new Error(`Channel not found: ${opts.channel}`);

    const subs = await ctx.fns.zulip.api({ path: `/streams/${ch.id}/members`, instance });
    const ids = new Set(subs.subscribers || []);
    return all.filter((m: any) => ids.has(m.id));
}
