export type QueryOpts = {
    /** Concise research question to send to Consensus. */
    query: string;
    /** Existing Consensus thread for a contextual follow-up. */
    thread_id?: string;
    /** Maximum ranked papers to return. @default 10 @minimum 1 @maximum 50 */
    limit?: number;
    /** Consensus search mode. @default "PRO_ANALYSIS" */
    mode?: string;
    /** Evidence and publication filters. */
    filters?: types.research.Filters;
    /** Keep the Consensus thread out of normal history when supported. @default false */
    incognito?: boolean;
    /** Named Chrome CDP session that holds Consensus login cookies. @default "research-consensus" */
    session?: string;
};
