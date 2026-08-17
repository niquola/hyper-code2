/** Reasoning controls supported by one concrete provider/model route. */
export type ReasoningProfile = {
    /** User-facing effort levels accepted for this model. */
    supported: types.llm.ReasoningEffort[];
    /** Applied level when the agent preference is auto. */
    defaultEffort: Exclude<types.llm.ReasoningEffort, "auto">;
    /** Provider wire representation used by the stream implementation. */
    mode: "none" | "openai-effort" | "anthropic-adaptive";
};
