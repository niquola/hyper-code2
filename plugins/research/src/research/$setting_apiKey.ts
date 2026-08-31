export default {
    type: "secret",
    env: "CONSENSUS_API_KEY",
    default: null,
    title: "Consensus API key",
    description: "Official Consensus API key from consensus.app/api-mcp; falls back to CONSENSUS_API_KEY.",
};
