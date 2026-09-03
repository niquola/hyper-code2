export default {
    type: 'string',
    env: 'LLM_FALLBACK_MODELS',
    default: 'codex:gpt-5.4-mini,kimi-coding:kimi-for-coding',
    title: 'LLM fallback models',
    description: 'Comma-separated models tried by llm.call after a usage limit, rate limit, transient provider failure, or unavailable primary model. Explicit model overrides use the same fallback chain.',
};
