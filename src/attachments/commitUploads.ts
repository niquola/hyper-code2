/**
 * Link persisted upload metadata to its chat message
 *
 * Commits pending upload records after the user message index is allocated. Use immediately after appendMessage succeeds.
 * @param opts.agentId Owning agent identifier.
 * @param opts.messageIdx Allocated user message index.
 * @param opts.uploads Pending uploads returned by attachments.saveUploads.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Owning agent identifier. */
        agentId: string;
        /** Allocated user message index. */
        messageIdx: number;
        /** Pending uploads returned by attachments.saveUploads. */
        uploads: Array<{ ref: types.tools.Content; pending: Record<string, any> }>;
    },
): Promise<{ count: number }> {
    let count = 0;
    for (const item of opts.uploads) {
        const ref: any = item.ref;
        const pending: any = item.pending;
        if (!ref?.attachmentId || !pending?.storagePath) continue;
        await ctx.fns.procs.db.run({
            sql: "INSERT INTO attachments(id,agent_id,message_idx,blob_hash,storage_path,original_name,mime_type,size_bytes,kind,extracted_text,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            params: [ref.attachmentId, opts.agentId, opts.messageIdx, pending.hash, pending.storagePath, ref.fileName, ref.mimeType, ref.size, pending.kind, pending.extractedText, Date.now()],
        });
        count++;
    }
    return { count };
}
