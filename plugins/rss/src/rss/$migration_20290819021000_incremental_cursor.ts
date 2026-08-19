const sql=`
ALTER TABLE rss.feeds ADD COLUMN IF NOT EXISTS cursor jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE rss.entries ADD COLUMN IF NOT EXISTS content_hash text;
UPDATE rss.feeds SET cursor=jsonb_strip_nulls(jsonb_build_object(
  'etag',etag,
  'lastModified',last_modified,
  'newestPublishedAt',(SELECT max(e.published_at) FROM rss.entries e WHERE e.feed_key=rss.feeds.key),
  'newestExternalId',(SELECT e.external_id FROM rss.entries e WHERE e.feed_key=rss.feeds.key ORDER BY e.published_at DESC NULLS LAST,e.last_seen_at DESC LIMIT 1)
)) WHERE cursor='{}'::jsonb;
`;
export default {up:async(ctx:Context)=>{await ctx.fns.procs.db.exec({sql})},down:async(ctx:Context)=>{await ctx.fns.procs.db.exec({sql:"ALTER TABLE rss.entries DROP COLUMN IF EXISTS content_hash; ALTER TABLE rss.feeds DROP COLUMN IF EXISTS cursor"})}};
