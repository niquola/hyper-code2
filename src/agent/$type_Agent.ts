export type Agent = {
    id: string;
    model: string;
    systemPrompt: string;
    messages: any[];                        // synchronized runtime view of DB-backed transcript
    events: any[];                          // synchronized runtime view of DB-backed event trace
    cursors: Record<string, number>;
    subscribers: Set<(ev: any, signal?: AbortSignal) => void>;
    waiters: Array<() => void>;
    isStreaming: boolean;
    abortController: AbortController | null;
    tools: any[];
    scratchpad: Record<string, any>;
    parentId?: string | null;
    forkOffset?: number | null;
};
