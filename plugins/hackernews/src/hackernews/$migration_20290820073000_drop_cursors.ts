/** Collapses the former one-to-one cursor table back into `hackernews.feeds.cursor`. */
export default { up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "DROP TABLE IF EXISTS hackernews.cursors" }); } };
