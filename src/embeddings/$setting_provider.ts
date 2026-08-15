export default {
    type: "enum",
    env: "EMBEDDINGS_PROVIDER",
    default: "off",
    options: ["off", "openai"],
    title: "Embeddings provider",
    description: "Optional semantic retrieval provider. Off keeps runtime function search BM25-only.",
};
