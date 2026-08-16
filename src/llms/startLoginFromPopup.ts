// Form RPC target: starts the real provider login and immediately replaces the
// popup body with safe progress (URL/code for Codex, browser instruction for
// Claude). No credential crosses this RPC boundary.
/** Starts a typed subscription login and returns its safe progress popup. */
/**
 * Start an official Claude Code or Codex account login from the popup form.
 *
 * Returns only account name, status, verification URL and device code. Access
 * and refresh tokens remain exclusively in the provider-owned credential store.
 *
 * @param opts.provider Provider login type.
 * @param opts.account New account slot name.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Provider to authenticate. */ provider: "claude-code" | "codex";
    /** Account slot name. */ account: string;
}): Promise<string> {
    const provider = opts.provider;
    if (provider !== "claude-code" && provider !== "codex") throw new Error("unsupported provider");
    await ctx.fns.llm.startAccountLogin({ provider, account: opts.account });
    const flow = [...ctx.fns.llm.accountLoginStatus({})].reverse().find((f: any) => f.provider === provider && f.account === opts.account) ?? null;
    return ctx.fns.ui.popupContent({
        title: provider === "claude-code" ? "Claude Code login" : "Codex login",
        kind: "login-progress",
        html: ctx.fns.llms.loginPopup({ provider, flow }),
    });
}
