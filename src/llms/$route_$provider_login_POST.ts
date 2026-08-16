/** Starts adding a named Codex or Claude Code subscription account. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Incoming form request. */ req: Request;
    /** Route parameters, including provider. */ params: Record<string, string>;
}) {
    const provider = String(opts.params.provider ?? "");
    if (provider !== "codex" && provider !== "claude-code") return new Response("unsupported provider", { status: 404 });
    const form = await opts.req.formData();
    const account = String(form.get("account") ?? "").trim();
    try { await ctx.fns.llm.startAccountLogin({ provider, account }); }
    catch (error: any) {
        await ctx.fns.ui.notify({ level: "error", message: `Cannot add ${provider}/${account}`, body: error?.message ?? String(error) }).catch(() => {});
    }
    return new Response(null, { status: 303, headers: { location: "/llms" } });
}
