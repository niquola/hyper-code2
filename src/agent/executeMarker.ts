// Execute a single marker call from an LLM turn and persist the result.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { agent: types.agent.Agent; call: types.agent.MarkerCall; usage?: any },
): Promise<void> {
    const { agent, call } = opts;
    const usage = opts.usage;

    const markerText = ctx.fns.agent.serializeMarkerCall({ call });
    const append = ctx.fns.session.appendAssistantMessage({ id: agent.id, msg: { content: markerText } });
    ctx.fns.session.syncAgentState({ agent });

    if (call.kind === 'html') {
        const html = ctx.fns.agent.sanitizeHtmlBody({ html: call.content });
        await ctx.fns.session.appendAssistantEvent({ id: agent.id, payload: {
            text: '', html, usage, messageIdx: append.idx,
        } });
        ctx.fns.session.syncAgentState({ agent });
        return;
    }

    let output = '';
    let isError = false;
    try {
        if (call.kind === 'eval') {
            output = await ctx.fns.repl.eval({ code: call.content, agent });
        } else if (call.kind === 'write') {
            await ctx.fns.files.write({ path: call.path, content: call.content });
            const lines = call.content.split('\n').length;
            output = `wrote ${call.path} (${call.content.length} bytes, ${lines} lines)`;
        } else if (call.kind === 'bash') {
            const r = await ctx.fns.agent.executeBash({ code: call.content });
            output = r.output;
            isError = r.isError;
        } else if (call.kind === 'read') {
            const readOpts = ctx.fns.agent.parseReadMarker({ body: call.path });
            if (call.format === 'hashline') {
                const r = await ctx.fns.files.readHashline(readOpts);
                output = r.text;
            } else {
                const text = await ctx.fns.files.read({ path: readOpts.path });
                const start = Math.max(1, readOpts.startLine ?? 1);
                const lines = text.replaceAll('\r\n', '\n').split('\n');
                let end = Math.max(start, readOpts.endLine ?? lines.length);
                if (readOpts.maxLines != null) end = Math.min(end, start + Math.max(0, readOpts.maxLines - 1));
                output = lines.slice(start - 1, end).join('\n');
            }
        } else if (call.kind === 'grep') {
            const kv = Object.fromEntries(
                call.content.split('\n')
                    .map(x => x.trim())
                    .filter(Boolean)
                    .map(line => {
                        const i = line.indexOf(':');
                        return i >= 0 ? [line.slice(0, i).trim(), line.slice(i + 1).trim()] : [line, ""];
                    }),
            );
            if (!kv.pattern) throw new Error("grep requires 'pattern: ...'");
            const max = kv.max ? Number(kv.max) : undefined;
            if (call.format === 'hashline') {
                const rows = await ctx.fns.files.grepHashline({
                    pattern: kv.pattern,
                    path: kv.path || undefined,
                    glob: kv.glob || undefined,
                    caseSensitive: kv.caseSensitive === 'true',
                    max,
                });
                output = rows.map((r: any) => `${r.path}:${r.anchor}:${r.column}|${r.text}`).join('\n');
            } else {
                const rows = await ctx.fns.files.grep({
                    pattern: kv.pattern,
                    path: kv.path || undefined,
                    glob: kv.glob || undefined,
                    caseSensitive: kv.caseSensitive === 'true',
                    max,
                });
                output = rows.map((r: any) => `${r.path}:${r.line}:${r.column}|${r.text}`).join('\n');
            }
        } else if (call.kind === 'edit') {
            if (call.format && call.format !== 'hashline') throw new Error(`unsupported edit format: ${call.format}`);
            const r = await ctx.fns.files.editHashline({ input: call.content });
            output = `edited ${r.path} (${r.bytes} bytes)`;
        }
    } catch (e: any) {
        output = 'Error: ' + (e?.message ?? String(e));
        isError = true;
    }

    const codeLang = call.kind === 'bash' ? 'bash' : 'ts';
    const argsHtml = await ctx.fns.markdown.highlight({ code: 'content' in call ? call.content : call.path, lang: codeLang });
    const resultHtml = await ctx.fns.agent.highlightResult({ output });
    await ctx.fns.session.appendToolCallEvent({ id: agent.id, payload: {
        name: call.kind,
        args: call.kind === 'write' ? { path: call.path, content: call.content }
            : call.kind === 'read' ? { path: call.path, format: call.format }
            : { code: (call as any).content, format: (call as any).format },
        result: output,
        argsHtml, resultHtml, isError,
        // Anchor this event to the assistant marker message so delete/truncate
        // can map an event boundary back to a message boundary (and vice-versa).
        messageIdx: append.idx,
    } });

    const resultText = ctx.fns.agent.formatMarkerResult({ call, output, isError });
    ctx.fns.session.appendMessage({ id: agent.id, message: {
        role: 'user', content: resultText, excluded_from_cursor: true,
    } });
    ctx.fns.session.syncAgentState({ agent });
}
