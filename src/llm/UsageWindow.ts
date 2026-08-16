/** One rolling quota window of a subscription, as reported by the provider. */
export type UsageWindow = {
    /** Percentage of the window consumed, 0..100. */
    usedPercent: number;
    /** Window length in minutes, when the provider states it. */
    windowMinutes?: number | null;
    /** When the window resets, ms epoch; null when unknown. */
    resetsAt?: number | null;
};
