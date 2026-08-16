// Popup RPC entrypoint used by the typed +Claude/+Codex buttons.
/** Returns the safe popup content for starting one official provider login. */
/**
 * Build the typed account-login popup for Claude Code or Codex.
 *
 * The form posts to the provider-specific login route. It explains where the
 * credential will live and explicitly guarantees that no access/refresh token
 * is returned through the popup RPC.
 *
 * @param opts.provider Provider login type.
 */
export default function (ctx: Context, _session: Session | null, opts: {
    /** Provider to authenticate. */ provider: "claude-code" | "codex";
}): string {
    const provider = opts.provider;
    if (provider !== "claude-code" && provider !== "codex") throw new Error("unsupported provider");
    return ctx.fns.ui.popupContent({
        title: provider === "claude-code" ? "Add Claude Code account" : "Add Codex account",
        kind: "login",
        html: ctx.fns.llms.loginPopup({ provider, flow: null }),
    });
}
