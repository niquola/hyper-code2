/** Performs the llm.logoutAnthropicOAuth runtime operation. */
/**
 * Delete the stored Anthropic OAuth credentials.
 */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<{ ok: true }> {
    await ctx.fns.procs.db.run({ sql: "DELETE FROM oauth_credentials WHERE provider = ?", params: ["anthropic-oauth"] });
    const store: any = (ctx.state as any).llm?.anthropicOAuth;
    if (store) {
        for (const p of store.pending?.values?.() ?? []) try { p.server?.close(); } catch {}
        store.pending?.clear?.();
        store.lastError = null;
    }
    return { ok: true };
}
