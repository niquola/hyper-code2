// Where the ring stops being neutral. Below this the quota is not a factor in
// any decision; above it, "should I switch model before starting something
// long?" becomes a real question.
export default {
    type: "number" as const,
    default: 50,
    env: "LLM_USAGE_WARN_PERCENT",
    label: "Quota warning threshold, %",
    description: "Percentage of a subscription window at which the quota ring turns yellow.",
};
