// Lightweight in-process tracing state. Spans are written as NDJSON and kept
// in a bounded ring for live diagnosis; telemetry never depends on Postgres.
export type State = {
    enabled: boolean;
    file: string;
    slowMs: number;
    maxRecent: number;
    recent: any[];
    active: Map<string, any>;
    buffer: string[];
    flushTimer?: ReturnType<typeof setInterval>;
    flushChain: Promise<void>;
    als: any;
    dropped: number;
};
