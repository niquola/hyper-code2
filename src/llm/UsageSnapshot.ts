/**
 * How much of a subscription's quota is spent, as last reported by the
 * provider. Recorded by llm.recordUsage from response headers and stream
 * payloads; never fetched on its own.
 */
export type UsageSnapshot = {
    /** Provider name, e.g. "codex". */
    provider: string;
    /** Credential account within the provider, "default" when unnamed. */
    account: string;
    /** Rolling windows: primary is the short one (5h), secondary the long one (7d). */
    windows: {
        primary?: types.llm.UsageWindow;
        secondary?: types.llm.UsageWindow;
    };
    /** Subscription plan reported by the provider, e.g. "prolite". */
    planType?: string | null;
    /** When this snapshot was taken, ms epoch. */
    updatedAt: number;
    /** Where the numbers came from. */
    source: "headers" | "stream" | "error";
    /** When a threshold warning last fired for the current window, ms epoch. */
    warnedAt?: number | null;
};
