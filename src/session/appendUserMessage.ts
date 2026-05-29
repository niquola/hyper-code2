export default async function (ctx: Context, opts: { id: string; text: string; ts?: number }) {
    const { id, text } = opts;
    // A user turn with no text is never valid: it carries nothing for the model
    // and persists as a NULL-content row that later 400s the Anthropic call
    // ("text content blocks must be non-empty"). The only way this happens is a
    // caller bug (e.g. a reentrant agent.run() with userText === undefined), so
    // fail loudly here rather than poison the transcript.
    if (text == null || String(text).trim() === "") {
        throw new Error("appendUserMessage: refusing to append empty user text");
    }
    const ts = opts.ts ?? Date.now();
    const out = ctx.fns.session.appendMessage(ctx, { id, message: { role: "user", content: text }, ts });
    const event = { type: "user", text, messageIdx: out.idx } as any;
    event.html = await ctx.fns.agent.renderEventHtml(ctx, { event, agentId: id });
    ctx.fns.session.appendEvent(ctx, { id, event, ts });
    return out;
}
