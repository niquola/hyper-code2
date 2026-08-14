// Submit a pull-request review. APPROVE and REQUEST_CHANGES have repository
// workflow consequences, so every review event requires explicit confirmation.
/** Submit a pull-request review after explicit confirmation.
 * @param ctx Runtime context.
 * @param _session Unused session supplied by the procedural runtime.
 * @param opts Review submission options.
 * @returns The created GitHub pull-request review resource.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Repository owner or organization login. */ owner: string;
    /** Repository name. */ repo: string;
    /** Pull-request number. */ n: number;
    /** Review action to submit. */ event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
    /** Optional overall Markdown review body. */ body?: string;
    /** Commit SHA to review. */ commitId?: string;
    /** Inline review comments attached to changed lines. */
    comments?: Array<{
        /** Repository-relative file path. */ path: string;
        /** Line number in the diff side being commented on. */ line: number;
        /** Diff side; omitted values are sent as `RIGHT`. */ side?: "LEFT" | "RIGHT";
        /** Markdown inline-comment body. */ body: string;
    }>;
    /** Must be `true` after explicit user approval. */ confirm?: boolean;
}): Promise<any> {
    if (!opts?.owner || !opts.repo || !opts.n || !opts.event) throw new Error("gh.review requires owner, repo, n and event");
    if (!(["APPROVE", "REQUEST_CHANGES", "COMMENT"] as string[]).includes(opts.event)) throw new Error("gh.review event must be APPROVE, REQUEST_CHANGES or COMMENT");
    if ((opts.event === "REQUEST_CHANGES" || opts.event === "COMMENT") && !opts.body && !opts.comments?.length) {
        throw new Error(`${opts.event} review requires body or inline comments`);
    }
    if (opts.confirm !== true) throw new Error("gh.review is a real write; repeat with confirm: true after explicit user approval");
    return ctx.fns.gh.api({
        route: "POST /repos/{owner}/{repo}/pulls/{n}/reviews",
        path: { owner: opts.owner, repo: opts.repo, n: opts.n },
        confirm: true,
        body: {
            event: opts.event,
            ...(opts.body !== undefined ? { body: opts.body } : {}),
            ...(opts.commitId ? { commit_id: opts.commitId } : {}),
            ...(opts.comments?.length ? { comments: opts.comments.map(c => ({ path: c.path, line: c.line, side: c.side ?? "RIGHT", body: c.body })) } : {}),
        },
    });
}
