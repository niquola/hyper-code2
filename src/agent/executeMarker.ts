// Execute a single marker call from an LLM turn and persist the result.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { agent: types.agent.Agent; call: types.agent.MarkerCall; usage?: any },
): Promise<{ isError: boolean; markerIdx?: number; resultIdx?: number }> {
    const { agent, call } = opts;
    const usage = opts.usage;

    // A derived context gives this marker chain an agent-scoped workspace.
    // Never mutate process.cwd(): agents execute concurrently.
    const executionCtx: any = Object.create(ctx);
    executionCtx.session = ctx.fns.session.forAgent({ agent });
    executionCtx.session.kind = "agent-marker";
    ctx = executionCtx;

    const markerText = ctx.fns.agent.serializeMarkerCall({ call });
    const append = await ctx.fns.session.appendAssistantMessage({ id: agent.id, msg: { content: markerText } });
    await ctx.fns.session.syncAgentState({ agent });

    if (call.kind === 'html') {
        const html = ctx.fns.agent.sanitizeHtmlBody({ html: call.content });
        await ctx.fns.session.appendAssistantEvent({ id: agent.id, payload: {
            text: '', html, usage, messageIdx: append.idx,
        } });
        await ctx.fns.session.syncAgentState({ agent });
        return { isError: false };
    }

    if (call.kind === 'evalHtml') {
        const html = ctx.fns.agent.sanitizeHtmlBody({ html: await ctx.fns.repl.eval({ code: call.content, agent }) });
        await ctx.fns.session.appendAssistantEvent({ id: agent.id, payload: {
            text: '', html, usage, messageIdx: append.idx,
        } });
        await ctx.fns.session.syncAgentState({ agent });
        return { isError: false };
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
            // Actionable feedback: a code file that does not even parse is a
            // mistake the model can fix NOW (usually prose glued after the body
            // — close it with a bare § line). The write itself stands.
            const loader = /\.tsx$/.test(call.path) ? 'tsx' : /\.(ts)$/.test(call.path) ? 'ts' : /\.(jsx)$/.test(call.path) ? 'jsx' : /\.(js|mjs)$/.test(call.path) ? 'js' : null;
            if (loader) {
                try { new Bun.Transpiler({ loader: loader as any }).transformSync(call.content); }
                catch (pe: any) {
                    output += `\nWARNING: the file does NOT parse (${String(pe?.message ?? pe).split('\n')[0]?.slice(0, 160)}). ` +
                        'If you wrote prose after the code, close the §write body with a bare § line first — everything until then goes INTO the file. Fix the file now.';
                }
            }
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

    // Postgres text refuses NUL bytes — a §read of a binary or bash output
    // with \0 must not kill the whole run at the INSERT (it did: agent cm).
    output = output.replaceAll('\u0000', '\uFFFD');

    // Oversized results go to agent.scratchpad.results — the transcript (and
    // the tool_call event) carry a preview + pointer; §eval reads the rest.
    output = await ctx.fns.agent.stashResult({ agent, output, kind: call.kind });

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
    const resAppend = await ctx.fns.session.appendMessage({ id: agent.id, message: {
        role: 'user', content: resultText, excluded_from_cursor: true,
    } });
    await ctx.fns.session.syncAgentState({ agent });
    return { isError, markerIdx: append.idx, resultIdx: resAppend.idx };
}
