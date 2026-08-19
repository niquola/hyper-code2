const sql=`
CREATE SCHEMA IF NOT EXISTS rss;
CREATE TABLE IF NOT EXISTS rss.feeds(
  key text PRIMARY KEY,
  url text NOT NULL UNIQUE,
  label text NOT NULL,
  badge text,
  category text,
  enabled boolean NOT NULL DEFAULT true,
  etag text,
  last_modified text,
  last_loaded_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rss.entries(
  feed_key text NOT NULL REFERENCES rss.feeds(key) ON DELETE CASCADE,
  external_id text NOT NULL,
  title text NOT NULL,
  url text,
  author text,
  published_at timestamptz,
  description text,
  content text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  news_id text,
  PRIMARY KEY(feed_key,external_id)
);
CREATE INDEX IF NOT EXISTS rss_entries_published_idx ON rss.entries(feed_key,published_at DESC NULLS LAST);
CREATE TABLE IF NOT EXISTS rss.runs(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feed_key text NOT NULL REFERENCES rss.feeds(key) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  fetched integer NOT NULL DEFAULT 0,
  added integer NOT NULL DEFAULT 0,
  published integer NOT NULL DEFAULT 0,
  error text
);
CREATE INDEX IF NOT EXISTS rss_runs_feed_idx ON rss.runs(feed_key,started_at DESC);
`;
export default {up:async(ctx:Context)=>{await ctx.fns.procs.db.exec({sql})},down:async(ctx:Context)=>{await ctx.fns.procs.db.exec({sql:"DROP SCHEMA IF EXISTS rss CASCADE"})}};
