// Execute a single marker call from an LLM turn and persist the result.
// One invocation = one assistant message (the marker text) + one event
// (tool_call or assistant for §html) + one synthetic user feedback message
// (§result:* — §html doesn't get one), so the model sees a clean per-call
// pairing when it reads the transcript on the next turn.
//
// Marker kinds:
//   §eval    — run JS via ctx.fns.repl.eval; output is captured stdout/return
//   §write   — write file via ctx.fns.files.write; output is "wrote N bytes"
//   §bash    — run shell via ctx.fns.agent.executeBash
//   §html    — sanitise raw HTML body (strip <!doctype>, <html>, <body>,
//              <style>, <script>) and inject as a chat bubble. No
//              templating, no JS execution. The model SEES its own
//              bubble, so no synthetic feedback.
export default async function (
    ctx: Context,
    opts: { agent: types.agent.Agent; call: types.agent.MarkerCall; usage?: any },
): Promise<void> {
    const { agent, call } = opts;
    const usage = opts.usage;

    // 1. Persist this marker as its own assistant message.
    const markerText = ctx.fns.agent.serializeMarkerCall(ctx, { call });
    const append = ctx.fns.session.appendAssistantMessage(ctx, { id: agent.id, msg: { content: markerText } });
    ctx.fns.session.syncAgentState(ctx, { agent });

    // 2. §html — plain HTML, sanitised. No tool_call event, no §result feedback.
    if (call.kind === 'html') {
        const html = ctx.fns.agent.sanitizeHtmlBody(ctx, { html: call.content });
        await ctx.fns.session.appendAssistantEvent(ctx, { id: agent.id, payload: {
            text: '', html, usage, messageIdx: append.idx,
        } });
        ctx.fns.session.syncAgentState(ctx, { agent });
        return;
    }

    // 3. eval / write / bash — execute, capture {output, isError}.
    let output = '';
    let isError = false;
    try {
        if (call.kind === 'eval') {
            output = await ctx.fns.repl.eval(ctx, { code: call.content, agent });
        } else if (call.kind === 'write') {
            await ctx.fns.files.write(ctx, { path: call.path, content: call.content });
            const lines = call.content.split('\n').length;
            output = `wrote ${call.path} (${call.content.length} bytes, ${lines} lines)`;
        } else if (call.kind === 'bash') {
            const r = await ctx.fns.agent.executeBash(ctx, { code: call.content });
            output = r.output;
            isError = r.isError;
        }
    } catch (e: any) {
        output = 'Error: ' + (e?.message ?? String(e));
        isError = true;
    }

    // 4. Persist tool_call event with highlighted args + result.
    const codeLang = call.kind === 'bash' ? 'bash' : 'ts';
    const argsHtml = await ctx.fns.markdown.highlight(ctx, { code: call.content, lang: codeLang });
    const resultHtml = await ctx.fns.agent.highlightResult(ctx, { output });
    await ctx.fns.session.appendToolCallEvent(ctx, { id: agent.id, payload: {
        name: call.kind,
        args: call.kind === 'write' ? { path: call.path, content: call.content } : { code: call.content },
        result: output,
        argsHtml, resultHtml, isError,
    } });

    // 5. Synthetic §result:* user message — what the model sees next turn.
    //    excluded_from_cursor=1 so workerLoop's user-frontier ignores it
    //    (otherwise every result row would retrigger another run).
    const resultText = ctx.fns.agent.formatMarkerResult(ctx, { call, output, isError });
    ctx.fns.session.appendMessage(ctx, { id: agent.id, message: {
        role: 'user', content: resultText, excluded_from_cursor: true,
    } });
    ctx.fns.session.syncAgentState(ctx, { agent });
}
