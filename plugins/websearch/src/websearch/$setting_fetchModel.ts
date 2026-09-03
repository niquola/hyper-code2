export default {
    type: 'string',
    env: 'WEBSEARCH_FETCH_MODEL',
    default: null,
    title: 'Web fetch model',
    description: 'Model used by websearch.fetch to apply a prompt to page content; when empty, the global default model is used.',
};
