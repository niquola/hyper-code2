// Claude's fallback auth code is a one-time secret. It travels directly from
// the secure popup field into the already-running CLI stdin and is never stored
// in Postgres, ctx state, logs, events, or the transcript.
/** Submits a one-time Claude authorization code to the pending CLI login. */
/**
 * Write the browser-provided one-time code into a pending Claude Code process.
 *
 * The value is consumed immediately and never persisted. Returns safe popup
 * progress after submission.
 *
 * @param opts.provider Login provider; currently only claude-code needs a code.
 * @param opts.account Pending account slot.
 * @param opts.code One-time authorization code displayed by Claude's browser flow.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Login provider. */ provider: "claude-code";
    /** Pending account slot. */ account: string;
    /** One-time browser authorization code. */ code: string;
}): Promise<string> {
    if (opts.provider !== "claude-code") throw new Error("only Claude Code accepts a pasted authorization code");
    const flow: any = (ctx.state as any).llm?.accountLogins?.get?.(`${opts.provider}:${opts.account}`);
    if (!flow || flow.status !== "pending" || !flow.proc?.stdin?.writable) throw new Error("Claude login is not waiting for a code");
    const code = String(opts.code ?? "").trim();
    if (!code || code.length > 4096) throw new Error("authorization code is missing or invalid");
    flow.proc.stdin.write(`${code}\n`);
    // Deliberately do NOT assign code to flow. The only durable trace is the
    // safe boolean that a code was submitted.
    flow.needsCode = false;
    flow.codeSubmitted = true;
    await Bun.sleep(150);
    const safe = ctx.fns.llm.accountLoginStatus({}).find((f: any) => f.provider === opts.provider && f.account === opts.account) ?? null;
    return ctx.fns.ui.popupContent({
        title: "Claude Code login",
        kind: "login-progress",
        html: ctx.fns.llms.loginPopup({ provider: opts.provider, flow: safe }),
    });
}
