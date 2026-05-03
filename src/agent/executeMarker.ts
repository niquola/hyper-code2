// Execute a single marker call from an LLM turn and persist the result.
// One invocation = one assistant message (the marker text) + one event
// (tool_call or assistant for §html) + one synthetic user feedback message
// (§result:* or §error:html), so the model sees a clean per-call pairing
// when it reads the transcript on the next turn.
//
// Marker kinds:
//   §eval    — run JS via ctx.fns.repl.eval; output is captured stdout/return
//   §write   — write file via ctx.fns.files.write; output is "wrote N bytes"
//   §bash    — run shell via ctx.fns.agent.executeBash
//   §html    — render TSX body; appendAssistantEvent with rendered HTML
//              (no synthetic feedback — the model SEES its own card)
//
// The §html branch is special: render errors become an §error:html
// feedback so the model can self-correct on the next turn. All other kinds
// produce a §result:* feedback regardless of success/error status.
export default async function (
    ctx: Context,
    agent: types.agent.Agent,
    call: types.agent.MarkerCall,
    opts: { usage?: any } = {},
): Promise<void> {
    const usage = opts.usage;

    // 1. Persist this marker as its own assistant message.
    const markerText = ctx.fns.agent.serializeMarkerCall(call);
    const append = ctx.fns.session.appendAssistantMessage(ctx, agent.id, { content: markerText });
    ctx.fns.session.syncAgentState(ctx, agent);

    // 2. §html — TSX render path. No tool_call event, no §result feedback.
    //    On render error: emit §error:html so the model self-corrects.
    if (call.kind === 'html') {
        let html = '';
        let renderError: any = null;
        try {
            const rendered = ctx.fns.agent.renderTsx(ctx, call.content, agent);
            html = ctx.fns.agent.sanitizeHtmlBody(rendered);
        } catch (e: any) {
            renderError = e;
        }
        if (renderError === null) {
            await ctx.fns.session.appendAssistantEvent(ctx, agent.id, {
                text: '', html, usage, messageIdx: append.idx,
            });
            ctx.fns.session.syncAgentState(ctx, agent);
        } else {
            const detail = ctx.fns.agent.describeTsxError(renderError, call.content);
            await ctx.fns.session.appendErrorEvent(ctx, agent.id, `§html render error:\n${detail}`);
            const hint = `§error:html\n${detail}\n\nThe §html body must be a valid TSX expression. Self-close void tags (\`<br/>\`, \`<img/>\`, \`<input/>\`), match every opening tag, and escape \`<\` / \`>\` in text content with \`&lt;\` / \`&gt;\`. {expr} blocks must be valid JS expressions.`;
            ctx.fns.session.appendMessage(ctx, agent.id, {
                role: 'user', content: hint, excluded_from_cursor: true,
            });
            ctx.fns.session.syncAgentState(ctx, agent);
        }
        return;
    }

    // 3. eval / write / bash — execute, capture {output, isError}.
    let output = '';
    let isError = false;
    try {
        if (call.kind === 'eval') {
            output = await ctx.fns.repl.eval(ctx, call.content, { agent });
        } else if (call.kind === 'write') {
            await ctx.fns.files.write(ctx, call.path, call.content);
            const lines = call.content.split('\n').length;
            output = `wrote ${call.path} (${call.content.length} bytes, ${lines} lines)`;
        } else if (call.kind === 'bash') {
            const r = await ctx.fns.agent.executeBash(ctx, call.content);
            output = r.output;
            isError = r.isError;
        }
    } catch (e: any) {
        output = 'Error: ' + (e?.message ?? String(e));
        isError = true;
    }

    // 4. Persist tool_call event with highlighted args + result.
    const codeLang = call.kind === 'bash' ? 'bash' : 'ts';
    const argsHtml = await ctx.fns.markdown.highlight(ctx, call.content, codeLang);
    const resultHtml = await ctx.fns.agent.highlightResult(ctx, output);
    await ctx.fns.session.appendToolCallEvent(ctx, agent.id, {
        name: call.kind,
        args: call.kind === 'write' ? { path: call.path, content: call.content } : { code: call.content },
        result: output,
        argsHtml, resultHtml, isError,
    });

    // 5. Synthetic §result:* user message — what the model sees next turn.
    //    excluded_from_cursor=1 so workerLoop's user-frontier ignores it
    //    (otherwise every result row would retrigger another run).
    const resultText = ctx.fns.agent.formatMarkerResult(call, output, isError);
    ctx.fns.session.appendMessage(ctx, agent.id, {
        role: 'user', content: resultText, excluded_from_cursor: true,
    });
    ctx.fns.session.syncAgentState(ctx, agent);
}
