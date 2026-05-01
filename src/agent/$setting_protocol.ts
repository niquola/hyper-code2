export default {
    type: 'enum',
    default: 'markers',
    options: ['markers', 'tool-calls'],
    title: 'Tool-call protocol',
    description: 'How the agent invokes tools. `markers` = ///eval / ///write:<path> in plain content (default; one escape level, robust to multi-line code). `tool-calls` = native OpenAI/Anthropic function-calling (fallback).',
};
