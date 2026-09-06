/**
 * Initialize durable sidebar pairing and tab binding tables.
 *
 * Use before sidebar operations; idempotently creates private first-party tables without changing agent transcripts.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {},
): Promise<void> {
    await ctx.fns.procs.db.exec({sql: `CREATE TABLE IF NOT EXISTS sidebar_pairs (id text PRIMARY KEY, token_hash text NOT NULL UNIQUE, origin text NOT NULL, approved boolean NOT NULL DEFAULT false, revoked boolean NOT NULL DEFAULT false, expires_at bigint NOT NULL, nonce text NOT NULL); CREATE TABLE IF NOT EXISTS sidebar_bindings (id text PRIMARY KEY, pair_id text NOT NULL REFERENCES sidebar_pairs(id), browser_epoch text NOT NULL, tab_id bigint NOT NULL, target_id text NOT NULL, browser_id text NOT NULL, agent_id text UNIQUE, state text NOT NULL DEFAULT 'active', url text NOT NULL DEFAULT '', title text NOT NULL DEFAULT '', context_revision integer NOT NULL DEFAULT 1, lease_until bigint NOT NULL DEFAULT 0, UNIQUE(pair_id,browser_epoch,tab_id));`});
    await ctx.fns.procs.db.exec({sql: "ALTER TABLE sidebar_bindings ADD COLUMN IF NOT EXISTS first_send_state text NOT NULL DEFAULT 'draft'"});
}
