/** Forward-only canonical sidecar field history. Creates an empty journal; never synthesizes history from observations. */
export default {
    async up(ctx: Context) {
        await ctx.fns.procs.db.exec({ sql: `
CREATE TABLE IF NOT EXISTS knowledge.entity_changes (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- Deliberately no cascading FK: audit facts survive entity/chat deletion.
    subject text NOT NULL,
    attribute text NOT NULL,
    operation text NOT NULL CHECK (operation IN ('create', 'add', 'correct')),
    before_value jsonb NOT NULL,
    after_value jsonb NOT NULL,
    source_agent_id text NOT NULL,
    source_message_idx integer NOT NULL CHECK (source_message_idx >= 0),
    url text NOT NULL,
    evidence text NOT NULL,
    changed_at timestamptz NOT NULL DEFAULT now()
);
-- Transaction timestamps can tie; the identity is the deterministic transition tie-breaker.
CREATE INDEX IF NOT EXISTS entity_changes_subject_time ON knowledge.entity_changes(subject, changed_at DESC, id DESC);
` });
    },
};
