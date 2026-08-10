// Trash a message (or untrash with { undo: true }).
export default async function (ctx: Context, session: Session | null, opts: { id: string; undo?: boolean; account?: string }) {
    await ctx.fns.gmail.api({ path: `/messages/${opts.id}/${opts.undo ? "untrash" : "trash"}`, method: "POST", account: opts.account });
    return { [opts.undo ? "untrashed" : "trashed"]: opts.id };
}
