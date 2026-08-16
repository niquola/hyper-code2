/**
 * Creates a Consensus research thread or continues an existing thread with its
 * context. Use as the low-level primitive behind research.search and research.ask.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Concise research question to send to Consensus. */ query: string;
        /** Existing Consensus thread for a contextual follow-up. */ thread_id?: string;
        /** Maximum ranked papers. @default 10 @minimum 1 @maximum 50 */ limit?: number;
        /** Consensus search mode. @default "PRO_ANALYSIS" */ mode?: string;
        /** Evidence and publication filters. */ filters?: types.research.Filters;
        /** Keep the thread out of normal Consensus history. @default false */ incognito?: boolean;
        /** Chrome CDP session holding Consensus cookies. @default "research-consensus" */ session?: string;
    },
): Promise<types.research.StartResult> {
    const query = String(opts?.query ?? "").trim();
    if (!query) throw new Error("research.start: query is required");
    const session = opts.session ?? "research-consensus";
    const limit = Math.max(1, Math.min(opts.limit ?? 10, 50));
    const filters: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(opts.filters ?? {})) {
        if (value !== undefined) filters[key] = Array.isArray(value) ? value.join(",") : value;
    }
    const body = {
        user_message: query,
        size: limit,
        filters,
        search_mode: opts.mode ?? "PRO_ANALYSIS",
        is_incognito: opts.incognito ?? false,
    };

    if (opts.thread_id) {
        const interaction: any = await ctx.fns.research.call({
            session,
            path: `/api/threads/${encodeURIComponent(opts.thread_id)}/`,
            method: "POST",
            body,
        });
        if (!interaction?.id) throw new Error("research.start: follow-up returned no interaction id");
        return { thread_id: opts.thread_id, interaction_id: String(interaction.id) };
    }

    const thread: any = await ctx.fns.research.call({ session, path: "/api/threads/", method: "POST", body });
    const threadId = thread?.thread_id;
    const interactionId = thread?.interactions?.[0]?.id;
    if (!threadId || !interactionId) throw new Error("research.start: Consensus returned an unexpected thread payload");
    return { thread_id: String(threadId), interaction_id: String(interactionId) };
}
