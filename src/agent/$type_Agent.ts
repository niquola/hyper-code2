export type Agent = {
    id: string;
    model: string;
    systemPrompt: string;
    messages: any[];                        // OpenAI chat format: user|assistant|tool
    events: any[];                          // UI trace
    cursors: Record<string, number>;
    subscribers: Set<(ev: any, signal?: AbortSignal) => void>;
    waiters: Array<() => void>;
    isStreaming: boolean;
    abortController: AbortController | null;
    tools: any[];
    scratchpad: Record<string, any>;
};
