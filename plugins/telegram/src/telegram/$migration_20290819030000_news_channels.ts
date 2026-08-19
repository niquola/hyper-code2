const sql=`
CREATE SCHEMA IF NOT EXISTS telegram;
CREATE TABLE IF NOT EXISTS telegram.news_channels(
  chat_id text PRIMARY KEY,
  title text NOT NULL,
  folder_id integer,
  enabled boolean NOT NULL DEFAULT true,
  cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS telegram.news_posts(
  chat_id text NOT NULL REFERENCES telegram.news_channels(chat_id) ON DELETE CASCADE,
  message_id bigint NOT NULL,
  content_hash text NOT NULL,
  news_id text,
  message_date timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(chat_id,message_id)
);
CREATE INDEX IF NOT EXISTS telegram_news_posts_date_idx ON telegram.news_posts(chat_id,message_date DESC);
`;
export default {up:async(ctx:Context)=>{await ctx.fns.procs.db.exec({sql})},down:async(ctx:Context)=>{await ctx.fns.procs.db.exec({sql:"DROP TABLE IF EXISTS telegram.news_posts; DROP TABLE IF EXISTS telegram.news_channels"})}};
