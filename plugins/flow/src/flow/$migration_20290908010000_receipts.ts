/** Stores reconciliation attempt receipts only; gaps remain computed from source facts. */
export default {async up(ctx:Context){await ctx.fns.procs.db.exec({sql:`CREATE SCHEMA IF NOT EXISTS flow; CREATE TABLE IF NOT EXISTS flow.receipts (id text PRIMARY KEY, flow text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), result jsonb NOT NULL)`});}};
