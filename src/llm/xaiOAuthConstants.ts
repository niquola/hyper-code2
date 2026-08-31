/** Return xAI's public Device OAuth client metadata and fixed endpoints. */
export default function (_ctx: Context, _session: Session | null, _opts?: {}): {
    provider: "xai-oauth";
    clientId: string;
    scope: string;
    deviceCodeUrl: string;
    tokenUrl: string;
} {
    return {
        provider: "xai-oauth",
        clientId: "b1a00492-073a-47ea-816f-4c329264a828",
        scope: "openid profile email offline_access grok-cli:access api:access",
        deviceCodeUrl: "https://auth.x.ai/oauth2/device/code",
        tokenUrl: "https://auth.x.ai/oauth2/token",
    };
}
