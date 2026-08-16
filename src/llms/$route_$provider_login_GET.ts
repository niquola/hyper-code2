/** Serves the typed provider login popup body. */
export default function (ctx: Context, _session: Session | null, opts: { params: Record<string, string> }) {
    const provider = String(opts.params.provider ?? "");
    if (provider !== "claude-code" && provider !== "codex") return new Response("unsupported provider", { status: 404 });
    const flows = ctx.fns.llm.accountLoginStatus({});
    const flow = [...flows].reverse().find((f: any) => f.provider === provider) ?? null;
    return new Response(ctx.fns.llms.loginPopup({ provider, flow }), { headers: { "content-type": "text/html; charset=utf-8" } });
}
