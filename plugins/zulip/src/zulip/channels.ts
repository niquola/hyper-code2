// List channels (streams) of a Zulip instance.
//   ctx.fns.zulip.channels({ instance: "fhir" })
// → [{ id, name, description }]
export default async function (ctx: Context, session: Session | null, opts?: { instance?: string }) {
    const data = await ctx.fns.zulip.api({ path: "/streams", instance: opts?.instance });
    return (data.streams || []).map((s: any) => ({
        id: s.stream_id,
        name: s.name,
        description: s.description || "",
    }));
}
