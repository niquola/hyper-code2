/**
 * Read durable browser binding and page context for an agent.
 *
 * Use in browser guards and prompt assembly. Closed or revoked bindings remain visible to ensure fail-closed guards. Verifies current CDP process identity.
 * @param opts.agentId Existing Hyper agent identifier.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Existing Hyper agent identifier. */
        agentId: string;
    },
): Promise<null | {bindingId:string;targetId:string;cdpSessionName:string;state:string;url:string;title:string;contextRevision:number}> {
    await ctx.fns.sidebar.ensureSchema({});
    const [r] = await ctx.fns.procs.db.select({sql:'SELECT b.*,p.revoked,p.expires_at FROM sidebar_bindings b JOIN sidebar_pairs p ON p.id=b.pair_id WHERE b.agent_id=?',params:[opts.agentId]});
    if (!r) return null;
    let state = r.revoked || Number(r.expires_at)<Date.now() ? 'revoked' : r.state;
    if (state==='active') {
        try {
            const t=await ctx.fns.sidebar.targetSnapshot({targetId:r.target_id});
            if(t.browserId!==r.browser_id) {
                state='revoked';
                await ctx.fns.procs.db.run({sql:"UPDATE sidebar_bindings SET state='revoked' WHERE id=?",params:[r.id]});
            } else {
                const [updated]=await ctx.fns.procs.db.select({sql:"UPDATE sidebar_bindings SET url=?,title=?,context_revision=context_revision+CASE WHEN url<>? OR title<>? THEN 1 ELSE 0 END WHERE id=? RETURNING *",params:[t.url,t.title,t.url,t.title,r.id]});
                if(updated) { r.url=updated.url; r.title=updated.title; r.context_revision=updated.context_revision; state=updated.state; }
            }
        } catch { state='unavailable'; }
    }
    return {bindingId:r.id,targetId:r.target_id,cdpSessionName:'sidebar:'+r.id,state,url:r.url,title:r.title,contextRevision:r.context_revision};
}
