// List drafts. ctx.fns.gmail.drafts({ max: 10 })
export default async function (ctx: Context, session: Session | null, opts?: { max?: number; account?: string }) {
    const res = await ctx.fns.gmail.api({ path: `/drafts?maxResults=${opts?.max ?? 20}`, account: opts?.account });
    return (res?.drafts ?? []).map((d: any) => ({ id: d.id, message: { id: d.message.id, threadId: d.message.threadId } }));
}
