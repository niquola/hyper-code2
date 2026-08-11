// Record a tool call in the transcript AND announce it in the corner.
//
// The transcript keeps a circle (see agent.renderEventHtml); the toast carries
// what actually happened — the verb, what it acted on, and the output as its
// body. That split is the point: the chat stays a conversation you can read,
// while the machinery reports beside it and fades on its own. A failure does
// not fade — it waits to be dismissed.
const PREVIEW = 1200;

export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        id: string;
        payload: { name: string; args: any; result: string; argsHtml: string; resultHtml: string; isError: boolean; messageIdx?: number };
        ts?: number;
    },
) {
    const appended = await ctx.fns.session.appendEventWithHtml({
        id: opts.id, type: "tool_call", payload: opts.payload, ts: opts.ts,
    });

    const { name, args, result, isError } = opts.payload;
    const meta = ctx.fns.agent.toolMeta({ name, args });

    // The toast shows what the transcript would: the code that ran and what it
    // printed, both highlighted in their own language. Clamped BEFORE
    // highlighting — a 200 KB result would otherwise be parsed to be thrown
    // away, and the corner of a screen is not where you read 200 KB.
    const body = String(result ?? "");
    const clamped = body.length > PREVIEW ? body.slice(0, PREVIEW) + `\n… (+${body.length - PREVIEW} chars)` : body;
    // What "the code" is depends on the tool: a shell command, a snippet, the
    // file body being written, or the replacements an edit applies. Reading
    // only command/code meant a write announced its size and hid its content —
    // the one thing worth seeing.
    const source = name === "edit"
        ? (args?.edits ?? []).map((e: any) => e.oldText != null
            ? `- ${String(e.oldText).split("\n")[0]}\n+ ${String(e.newText ?? "").split("\n")[0]}`
            : `${e.op ?? "edit"} @${e.anchor ?? ""}\n+ ${String(e.text ?? "").split("\n")[0]}`).join("\n")
        : String(args?.command ?? args?.code ?? args?.content ?? "");
    let bodyHtml: string | undefined;
    try {
        const parts: string[] = [];
        if (source) {
            parts.push(await ctx.fns.markdown.highlight({
                // A written file is the payload, so it gets a longer leash than a
            // one-line command.
            code: source.length > 1200 ? source.slice(0, 1200) + "\n…" : source,
                lang: name === "edit" ? "diff" : ctx.fns.agent.toolLang({ name, args, part: "args" }),
            }));
        }
        if (clamped) {
            parts.push(await ctx.fns.markdown.highlight({
                code: clamped,
                lang: ctx.fns.agent.toolLang({ name, args, part: "result" }),
            }));
        }
        bodyHtml = parts.join("") || undefined;
    } catch { bodyHtml = undefined; }

    await ctx.fns.ui.notify({
        agentId: opts.id,
        level: isError ? "error" : "info",
        message: `${meta.label} ${meta.subject}`.trim(),
        body: bodyHtml ? undefined : (clamped || undefined),
        bodyHtml,
    }).catch(() => {});

    return appended;
}
