export type Agent = {
    id: string;
    model: string;
    title: string;
    workspaceDir: string;
    systemPrompt: string;
    /** Narrow this agent to a subset of the declared tools (wire names). Unset
     *  = every loaded tool. What is excluded here never reaches the prompt or
     *  the provider's tool list, so it costs no prefix tokens either. */
    tools?: string[];
    messages: any[];                        // synchronized runtime view of DB-backed transcript
    events: any[];                          // synchronized runtime view of DB-backed event trace
    cursors: Record<string, number>;
    subscribers: Set<(ev: any, signal?: AbortSignal) => void>;
    waiters: Array<() => void>;
    isStreaming: boolean;
    abortController: AbortController | null;
    scratchpad: Record<string, any>;
    parentId?: string | null;
    statusLine?: string;
    statusLineEvery?: number;
    reflection?: Record<string, any> | null;
    forkOffset?: number | null;
    sleepContext?: Record<string, any> | null;
    currentJobId?: string | null;
    goal?: Record<string, any> | null;
    drainPromise?: Promise<any> | null;
};
