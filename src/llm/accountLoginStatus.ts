/** Returns safe UI state of in-progress subscription account logins. */
export default function (ctx: Context, _session: Session | null, _opts?: {}): Array<{
    provider: string; account: string; status: "pending" | "connected" | "failed";
    verificationUri: string | null; userCode: string | null; needsCode: boolean; error: string | null;
}> {
    const flows: Map<string, any> | undefined = (ctx.state as any).llm?.accountLogins;
    return [...(flows?.values?.() ?? [])]
        // Connected credentials have a durable account row; only actionable
        // progress/errors belong in this transient list.
        .filter((flow: any) => flow.status !== "connected")
        .map((flow: any) => ({
        provider: String(flow.provider), account: String(flow.account), status: flow.status,
        verificationUri: flow.verificationUri ?? null, userCode: flow.userCode ?? null,
        needsCode: flow.needsCode === true,
        error: flow.error ?? null,
    }));
}
