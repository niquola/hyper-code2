export default {
    type: "string",
    env: "EMBEDDINGS_LOCALES",
    default: "ru",
    title: "Retrieval locales",
    description: "Comma-separated locales generated once at indexing time for multilingual BM25 and semantic retrieval.",
};
