export default {
    type: 'enum',
    env: 'MODEL',
    default: 'minimax/minimax-m2.7',
    options: [
        'minimax/minimax-m2.7',
        'kimi:kimi-k2-turbo-preview',
        'openai:gpt-4o-mini',
        'openai:gpt-4o',
        'openrouter:anthropic/claude-3.5-sonnet',
    ],
    title: 'Default model',
    description: 'Used when no model is given to ctx.fns.ui.createAgent / /agent/new.',
};
