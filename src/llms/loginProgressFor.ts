// Re-opens a pending login from the account list. All actionable authorization
// metadata stays in UI; the user never needs terminal output.
/** Returns the progress popup for one pending subscription account login. */
/**
 * Reopen a Codex or Claude Code login by provider and account.
 *
 * Shows the authorization link, device code or Claude one-time-code field using
 * only safe metadata from llm.accountLoginStatus.
 *
 * @param opts.provider Login provider.
 * @param opts.account Pending account slot.
 */
export default function (ctx: Context, _session: Session | null, opts: {
    /** Login provider. */ provider: "claude-code" | "codex" | "xai";
    /** Pending account slot. */ account: string;
}): string {
    const flow = ctx.fns.llm.accountLoginStatus({}).find((f: any) => f.provider === opts.provider && f.account === opts.account);
    if (!flow) throw new Error("login flow not found or already completed");
    return ctx.fns.ui.popupContent({
        title: opts.provider === "codex" ? "Codex device login" : opts.provider === "xai" ? "Grok device login" : "Claude Code login",
        kind: "login-progress",
        html: ctx.fns.llms.loginPopup({ provider: opts.provider, flow }),
    });
}
