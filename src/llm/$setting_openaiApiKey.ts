export default {
    type: 'secret',
    env: 'OPENAI_API_KEY',
    default: null,
    title: 'OpenAI API key',
    description: 'sk-… — falls back to OPENAI_API_KEY env var.',
};
