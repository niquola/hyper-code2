// The agent turn loop. Marker-protocol only — we don't run native function
// calls. The model emits ///eval and ///write:<path> markers in plain content;
// parseMarkers extracts them, this loop executes each, appends a synthetic
// user message with the result (formatMarkerResult), and continues until the
// model returns a response with no markers (pure prose).
// Sanitize an ///html body before injecting it into the chat DOM. Models
// (notably Haiku) sometimes emit a full <!DOCTYPE> document with a <style>
// block that resets `body { margin: 40px auto }` — which then applies
// GLOBALLY to the chat page, producing visible padding around the body and
// other layout damage. Strip the document-level wrappers and any <style>
// or <script> blocks; keep the actual content. Tailwind utility classes
// inline still work because they're already loaded by $layout.ts.
function sanitizeHtmlBody(html: string): string {
    let s = html;
    s = s.replace(/<!doctype[^>]*>/gi, '');
    s = s.replace(/<\/?(?:html|head|body|meta|title|link)[^>]*>/gi, '');
    s = s.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    s = s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    return s.trim();
}

// --- Minimal JSX/TSX runtime for ///html bodies. -----------------------
// Body is treated as a TSX expression. Bun.Transpiler turns it into calls
// to h(...) / Fragment, then we evaluate that with `ctx` and `agent` in
// scope and render the resulting node tree to a string. Auto-escapes
// text and attribute values. Plain HTML fragments parse identically (no
// {expr} → no Transpiler complaints), so static markup just works.
const Fragment = Symbol('Fragment');
function h(tag: any, props: any, ...children: any[]): any {
    return { tag, props: props ?? {}, children: children.flat(Infinity) };
}
const VOID_TAGS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
function jsxRender(node: any): string {
    if (node == null || node === false || node === true) return '';
    if (typeof node === 'string' || typeof node === 'number') return Bun.escapeHTML(String(node));
    if (Array.isArray(node)) return node.map(jsxRender).join('');
    const { tag, props, children } = node;
    if (tag === Fragment) return (children ?? []).map(jsxRender).join('');
    if (typeof tag === 'function') return jsxRender(tag({ ...(props ?? {}), children: children ?? [] }));
    const attrs = Object.entries(props ?? {})
        .filter(([_, v]) => v != null && v !== false)
        .map(([k, v]) => v === true ? ` ${k}` : ` ${Bun.escapeHTML(k)}="${Bun.escapeHTML(String(v))}"`)
        .join('');
    if (VOID_TAGS.has(tag as string)) return `<${tag}${attrs}/>`;
    return `<${tag}${attrs}>${(children ?? []).map(jsxRender).join('')}</${tag}>`;
}
const TSX_TRANSPILER = new Bun.Transpiler({
    loader: 'tsx',
    tsconfig: JSON.stringify({
        compilerOptions: { jsx: 'react', jsxFactory: 'h', jsxFragmentFactory: 'Fragment' },
    }),
});
function renderTsxBody(body: string, ctx: Context, agent: any): string {
    // Wrap in a Fragment so the body can be: a single element, multiple
    // siblings, or even an element followed by trailing prose. That last
    // shape happens often in practice — Haiku writes a card then adds a
    // comment after, and a bare TSX `return (<div/> text);` would refuse.
    const js = TSX_TRANSPILER.transformSync(`return (<>${body}</>);`);
    const fn = new Function('h', 'Fragment', 'render', 'ctx', 'agent', js);
    const tree = fn(h, Fragment, jsxRender, ctx, agent);
    return jsxRender(tree);
}

function describeTsxError(e: any, body: string): string {
    const msg = (e?.message ?? String(e)) || 'unknown error';
    const pos = e?.position;
    const detail = pos
        ? `${msg}\nat line ${pos.line}, col ${pos.column}: ${String(pos.lineText ?? '').trim()}`
        : msg;
    const preview = body.length > 800
        ? body.slice(0, 800) + `\n…(+${body.length - 800} chars)`
        : body;
    return `${detail}\n\nbody:\n${preview}`;
}

async function highlightResult(ctx: Context, output: string): Promise<string> {
    const trimmed = output.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            const pretty = JSON.stringify(JSON.parse(trimmed), null, 2);
            return await ctx.fns.markdown.highlight(ctx, pretty, "json");
        } catch {}
    }
    return await ctx.fns.markdown.highlight(ctx, output, "javascript");
}

export default async function (
    ctx: Context,
    agent: types.agent.Agent,
    userText: string,
    opts: { userMessageAlreadyAppended?: boolean } = {},
) {
    const ac = new AbortController();
    agent.abortController = ac;

    if (!opts.userMessageAlreadyAppended) {
        await ctx.fns.session.appendUserMessage(ctx, agent.id, userText);
        ctx.fns.session.syncAgentState(ctx, agent);
    }

    while (true) {
        const { text, usage } = await ctx.fns.llm.stream(ctx, agent, { signal: ac.signal });

        const { prose, calls, errors } = ctx.fns.agent.parseMarkers(String(text ?? ''));

        // No markers and no parser errors — close the turn cleanly. Persist
        // the full assistant content verbatim (it's natural-language reply).
        if (calls.length === 0 && errors.length === 0) {
            // Skip empty completions entirely — they produce phantom bubbles
            // and have no informational value to either UI or LLM.
            if (!text || !String(text).trim()) {
                return { text: text ?? '', usage };
            }
            const append = ctx.fns.session.appendAssistantMessage(ctx, agent.id, { content: text });
            ctx.fns.session.syncAgentState(ctx, agent);
            const html = await ctx.fns.markdown.render(ctx, prose || text || '');
            await ctx.fns.session.appendAssistantEvent(ctx, agent.id, {
                text: prose || text || '', html, usage, messageIdx: append.idx,
            });
            ctx.fns.session.syncAgentState(ctx, agent);
            return { text, usage };
        }

        // We have markers (and possibly errors). Split the assistant turn
        // into a chain so the LLM sees clean per-call pairing on later turns:
        //   [assistant: prose?] → (assistant<marker> → user<result>)+ → [user: errors?]
        // Without this, multi-marker turns produce one giant assistant blob
        // and one user blob with all results stacked — model loses sight of
        // which result came from which call.

        if (prose.trim()) {
            const proseAppend = ctx.fns.session.appendAssistantMessage(ctx, agent.id, { content: prose });
            ctx.fns.session.syncAgentState(ctx, agent);
            const proseHtml = await ctx.fns.markdown.render(ctx, prose);
            await ctx.fns.session.appendAssistantEvent(ctx, agent.id, {
                text: prose, html: proseHtml, usage, messageIdx: proseAppend.idx,
            });
            ctx.fns.session.syncAgentState(ctx, agent);
        }

        for (const call of calls) {
            // Persist THIS marker as its own assistant message — paired with
            // its own result message immediately after.
            const markerText = call.kind === 'write'
                ? `///write:${call.path}\n${call.content}`
                : call.kind === 'html'
                    ? `///html\n${call.content}`
                    : `///eval\n${call.content}`;
            const append = ctx.fns.session.appendAssistantMessage(ctx, agent.id, { content: markerText });
            ctx.fns.session.syncAgentState(ctx, agent);

            // ///html: body is a TSX expression. Transpile + evaluate (with
            // `ctx`, `agent`, and `h`/`Fragment`/`render` in scope), render
            // the resulting node tree to a string, then sanitize. Plain HTML
            // fragments without {expr} parse identically, so static markup
            // still works. Errors come back as a synthetic ///error:html
            // user-message so the model can self-correct on the next turn.
            if (call.kind === 'html') {
                let html = '';
                let renderError: any = null;
                try {
                    html = sanitizeHtmlBody(renderTsxBody(call.content, ctx, agent));
                } catch (e: any) {
                    renderError = e;
                }
                if (renderError === null) {
                    await ctx.fns.session.appendAssistantEvent(ctx, agent.id, {
                        text: '', html, usage, messageIdx: append.idx,
                    });
                    ctx.fns.session.syncAgentState(ctx, agent);
                } else {
                    const detail = describeTsxError(renderError, call.content);
                    await ctx.fns.session.appendErrorEvent(ctx, agent.id, `///html render error:\n${detail}`);
                    const hint = `///error:html\n${detail}\n\nThe ///html body must be a valid TSX expression. Self-close void tags (\`<br/>\`, \`<img/>\`, \`<input/>\`), match every opening tag, and escape \`<\` / \`>\` in text content with \`&lt;\` / \`&gt;\`. {expr} blocks must be valid JS expressions.`;
                    ctx.fns.session.appendMessage(ctx, agent.id, {
                        role: 'user', content: hint, excluded_from_cursor: true,
                    });
                    ctx.fns.session.syncAgentState(ctx, agent);
                }
                continue;
            }

            let output = '';
            let isError = false;
            try {
                if (call.kind === 'eval') {
                    output = await ctx.fns.repl.eval(ctx, call.content, { agent });
                } else if (call.kind === 'write') {
                    await ctx.fns.files.write(ctx, call.path, call.content);
                    const lines = call.content.split('\n').length;
                    output = `wrote ${call.path} (${call.content.length} bytes, ${lines} lines)`;
                }
            } catch (e: any) {
                output = 'Error: ' + (e?.message ?? String(e));
                isError = true;
            }

            const argsHtml = await ctx.fns.markdown.highlight(ctx, call.content, 'ts');
            const resultHtml = await highlightResult(ctx, output);
            await ctx.fns.session.appendToolCallEvent(ctx, agent.id, {
                name: call.kind,
                args: call.kind === 'write' ? { path: call.path, content: call.content } : { code: call.content },
                result: output,
                argsHtml, resultHtml, isError,
            });

            const resultText = ctx.fns.agent.formatMarkerResult(call, output, isError);
            // Flag as tool-feedback so workerLoop's user-frontier ignores it —
            // otherwise every synthetic ///result row looks like a fresh user
            // input and retriggers another run (producing phantom bubbles).
            ctx.fns.session.appendMessage(ctx, agent.id, {
                role: 'user', content: resultText, excluded_from_cursor: true,
            });
            ctx.fns.session.syncAgentState(ctx, agent);
        }

        // Parser errors (misplaced markers, etc.) tail the chain as one user
        // message so the model can self-correct on the next turn.
        if (errors.length > 0) {
            for (const e of errors) {
                await ctx.fns.session.appendErrorEvent(ctx, agent.id, e.hint);
            }
            const errText = errors.map(e => ctx.fns.agent.formatMarkerError(e)).join('\n\n');
            ctx.fns.session.appendMessage(ctx, agent.id, {
                role: 'user', content: errText, excluded_from_cursor: true,
            });
            ctx.fns.session.syncAgentState(ctx, agent);
        }
    }
}
