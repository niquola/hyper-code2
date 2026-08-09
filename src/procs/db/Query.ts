// The db.sql / db.q query DSL shape → global types.db.Query.
export type Query = {
    select?: string | string[];
    from: string;
    // { col: val } → col = ? · { col: [..] } → col IN (..) · { col: { ">": 5 } } → col > ? · null → IS NULL
    where?: Record<string, any>;
    orderBy?: string;
    limit?: number;
    offset?: number;
};
