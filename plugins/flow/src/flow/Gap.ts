/** A current unmet need derived from facts, never a persisted queue row. */
export type Gap = {
    id: string;
    revision: string;
    summary: string;
    for?: string;
    /** Single available action; absent means informational only. */
    will?: string;
    facts?: Record<string, string | number | boolean | null>;
};
