/**
 * How much of a subscription's quota is spent, as last reported by the
 * provider. Recorded by llm.recordUsage from response headers, stream payloads,
 * and the explicit provider refresh performed for the /llms page.
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
    /** Codex one-shot rate-limit reset credits, when reported by the usage endpoint. */
    resetCredits?: { availableCount: number; credits?: Array<{ id: string; resetType?: string; status?: string; grantedAt?: string | number; expiresAt?: string | number | null; title?: string | null; description?: string | null }> } | null;
    /** When this snapshot was taken, ms epoch. */
    updatedAt: number;
    /** Where the numbers came from. */
    source: "headers" | "stream" | "error";
    /** When a threshold warning last fired for the current window, ms epoch. */
    warnedAt?: number | null;
};
