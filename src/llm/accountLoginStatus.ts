/** Returns safe UI state of in-progress subscription account logins. */
export default function (ctx: Context, _session: Session | null, _opts?: {}): Array<{
    provider: string; account: string; status: "pending" | "connected" | "failed";
    verificationUri: string | null; userCode: string | null; needsCode: boolean; error: string | null;
}> {
    const flows: Map<string, any> | undefined = (ctx.state as any).llm?.accountLogins;
    const cli = [...(flows?.values?.() ?? [])]
        .filter((flow: any) => flow.status !== "connected")
        .map((flow: any) => ({
            provider: String(flow.provider), account: String(flow.account), status: flow.status,
            verificationUri: flow.verificationUri ?? null, userCode: flow.userCode ?? null,
            needsCode: flow.needsCode === true, error: flow.error ?? null,
        }));
    const xai = [...((ctx.state as any).llm?.xaiOAuth?.pending?.values?.() ?? [])]
        .filter((flow: any) => flow.status !== "connected" && !flow.cancelled)
        .map((flow: any) => ({
            provider: "xai", account: String(flow.account), status: flow.status === "pending" ? "pending" : "failed",
            verificationUri: flow.verificationUri ?? null, userCode: flow.userCode ?? null,
            needsCode: false, error: flow.error ?? (flow.status === "expired" ? "device code expired" : null),
        }));
    return [...cli, ...xai];
}
