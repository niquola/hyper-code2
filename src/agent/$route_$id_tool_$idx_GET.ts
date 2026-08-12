// GET /agent/:id/tool/:idx — the BODY of one tool call: its arguments and its
// result, syntax-highlighted.
//
// It is a separate request on purpose. Highlighted code is one span per token,
// so a hundred collapsed tool cards carried thirteen thousand DOM nodes that
// nobody was looking at — enough to block the browser's main thread for
// seconds while the page loaded. The card now ships as a single line and asks
// for its body the first time it is opened.
export default async function (ctx: Context, _session: Session | null, opts: { params: Record<string, string> }) {
    const id = opts.params.id!;
    const idx = Number(opts.params.idx);
    if (!Number.isInteger(idx)) return new Response("bad idx", { status: 400 });

    const events = await ctx.fns.session.getEvents({ id, fromIdx: idx, limit: 1 });
    const event = events[0];
    if (!event || Number(event.idx) !== idx || event.type !== "tool_call") {
        return new Response("<div class=\"px-3 py-2 text-xs text-gray-400\">(no body)</div>", {
            headers: { "content-type": "text/html; charset=utf-8" },
        });
    }

    const result = String(event.result ?? "");
    const argsLang = ctx.fns.agent.toolLang({ name: event.name, args: event.args, part: "args" });
    const argsCode = argsLang === "json"
        ? JSON.stringify(event.args ?? {}, null, 2)
        : String(event.args?.code ?? event.args?.command ?? event.args?.content ?? "");
    const argsHtml = event.name === "edit"
        ? await ctx.fns.agent.renderEditArgs({ path: event.args?.path, edits: event.args?.edits })
        : await ctx.fns.markdown.highlight({ code: argsCode, lang: argsLang });
    const resultHtml = await ctx.fns.agent.highlightResult({
        output: result,
        lang: ctx.fns.agent.toolLang({ name: event.name, args: event.args, part: "result" }),
    });
    const html = `<div class="border-t border-gray-100 bg-gray-50/60 px-3 py-2 tool-code">${argsHtml}</div>`
        + (result ? `<div class="border-t border-gray-100 px-3 py-2 text-gray-700 tool-result">${resultHtml}</div>` : "");

    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
