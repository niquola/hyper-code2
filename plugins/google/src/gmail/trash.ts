// Trash a message (or untrash with { undo: true }).
/**
 * Move a Gmail message to or from the trash.
 *
 * @param opts - Options for the operation.
 * @param opts.id - Resource identifier.
 * @param opts.undo - When true, restore the message from trash instead of trashing it.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts: { id: string; undo?: boolean; account?: string }) {
    await ctx.fns.gmail.api({ path: `/messages/${opts.id}/${opts.undo ? "untrash" : "trash"}`, method: "POST", account: opts.account });
    return { [opts.undo ? "untrashed" : "trashed"]: opts.id };
}
