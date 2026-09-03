export default {
    type: 'enum',
    env: 'WEBSEARCH_DEFAULT_ENGINE',
    default: 'google-browser',
    options: ['google-browser', 'brave'],
    title: 'Default web search engine',
    description: 'Engine used by websearch.search when the caller does not select one.',
};
