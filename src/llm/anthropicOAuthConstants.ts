/** Performs the llm.anthropicOAuthConstants runtime operation. */
/**
 * Return constants used by the Anthropic OAuth flow.
 */
export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    return {
        clientId: ctx.env.ANTHROPIC_OAUTH_CLIENT_ID ?? "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
        authorizeUrl: ctx.env.ANTHROPIC_OAUTH_AUTHORIZE_URL ?? "https://claude.ai/oauth/authorize",
        tokenUrl: ctx.env.ANTHROPIC_OAUTH_TOKEN_URL ?? "https://platform.claude.com/v1/oauth/token",
        redirectUri: ctx.env.ANTHROPIC_OAUTH_REDIRECT_URI ?? "http://localhost:53692/callback",
        scopes: "org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload",
    };
}
