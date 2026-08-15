/** Adds the opt-in per-agent runtime-function RAG flag. */
export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "ALTER TABLE agents ADD COLUMN function_rag_enabled BOOLEAN NOT NULL DEFAULT FALSE" }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "ALTER TABLE agents DROP COLUMN function_rag_enabled" }); },
};
