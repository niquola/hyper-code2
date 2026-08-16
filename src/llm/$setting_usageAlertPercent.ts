// Where the ring turns red AND a toast fires — once per window. This is the
// last point at which switching model is a choice rather than a reaction, so it
// sits well before the wall, not next to it.
export default {
    type: "number" as const,
    default: 75,
    env: "LLM_USAGE_ALERT_PERCENT",
    label: "Quota alert threshold, %",
    description: "Percentage of a subscription window at which the quota ring turns red and one warning toast is sent.",
};
