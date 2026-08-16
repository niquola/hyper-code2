/**
 * What a failed LLM call actually means, and what the caller should do next.
 *
 * Produced by llm.classifyError from the HTTP status, body and headers of a
 * failed provider response.
 */
export type FailureInfo = {
    /**
     * usage_limit — subscription window spent, park until resetsAt.
     * rate_limit  — short throttling, retry after retryAfterMs.
     * transient   — network or 5xx, retry with backoff.
     * auth        — credentials rejected, needs a human.
     * overflow    — request exceeds the context window, needs compaction.
     * fatal       — nothing to retry; surface the message.
     */
    kind: "usage_limit" | "rate_limit" | "transient" | "auth" | "overflow" | "fatal";
    /** Provider name, e.g. "codex". */
    provider: string;
    /** Credential account within the provider, "default" when unnamed. */
    account: string;
    /** Human-readable explanation, safe to show in the UI. */
    message: string;
    /** Whether an automatic retry can possibly succeed. */
    retryable: boolean;
    /** HTTP status of the failed response, when there was one. */
    status?: number;
    /** When the subscription quota returns, ms epoch; null when unknown. */
    resetsAt?: number | null;
    /** How long to wait before retrying, ms. */
    retryAfterMs?: number;
    /** Subscription plan name reported by the provider, e.g. "prolite". */
    planType?: string;
    /** Truncated raw body, for diagnostics. */
    raw?: string;
};
