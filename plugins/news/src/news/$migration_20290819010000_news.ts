const sql = `
CREATE SCHEMA IF NOT EXISTS news;
CREATE TABLE IF NOT EXISTS news.items (
    id text PRIMARY KEY,
    title text NOT NULL,
    url text,
    author text,
    points integer,
    comments integer,
    topics text[],
    article_md text,
    summary text,
    query text,
    source text NOT NULL DEFAULT 'news',
    fetched_at timestamptz NOT NULL DEFAULT now(),
    shown_at timestamptz,
    liked_at timestamptz,
    reposted_at timestamptz,
    repost_ref text,
    read_at timestamptz,
    summary_long text,
    resummarized_at timestamptz,
    reposts jsonb NOT NULL DEFAULT '{}'::jsonb,
    search_vector tsvector GENERATED ALWAYS AS (
      to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(summary_long,'') || ' ' || coalesce(article_md,'') || ' ' || coalesce(author,'') || ' ' || coalesce(source,''))
    ) STORED
);
CREATE INDEX IF NOT EXISTS news_items_time_idx ON news.items(coalesce(shown_at,fetched_at) DESC);
CREATE INDEX IF NOT EXISTS news_items_source_idx ON news.items(source,coalesce(shown_at,fetched_at) DESC);
CREATE INDEX IF NOT EXISTS news_items_unread_idx ON news.items(coalesce(shown_at,fetched_at) DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS news_items_search_idx ON news.items USING gin(search_vector);
`;
export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({sql}); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({sql:"DROP SCHEMA IF EXISTS news CASCADE"}); },
};
