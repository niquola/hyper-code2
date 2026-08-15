/** Rebuilds function BM25 with Russian stemming for localized retrieval text. */
export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: `
        DROP INDEX IF EXISTS functions_bm25;
        CREATE INDEX functions_bm25 ON functions USING bm25
          (name, namespace, summary, doc, signature, (search_text::pdb.simple('stemmer=russian')))
          WITH (key_field='name');
    ` }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: `
        DROP INDEX IF EXISTS functions_bm25;
        CREATE INDEX functions_bm25 ON functions USING bm25
          (name, namespace, summary, doc, signature, search_text)
          WITH (key_field='name');
    ` }); },
};
