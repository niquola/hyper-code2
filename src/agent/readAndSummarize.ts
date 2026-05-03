export default async function (
    ctx: Context,
    opts: { agent: types.agent.Agent; file: string; task: string; maxChars?: number; model?: string },
): Promise<{ file: string; summary: string; usage: any }> {
    const { agent } = opts;
    const file = String(opts?.file ?? '').trim();
    const task = String(opts?.task ?? '').trim();
    const maxChars = Number(opts?.maxChars ?? 120000);
    const model = opts?.model ? String(opts.model) : undefined;

    if (!file) throw new Error('readAndSummarize: file is required');
    if (!task) throw new Error('readAndSummarize: task is required');

    const exists = await ctx.fns.files.exists(ctx, { path: file });
    if (!exists) throw new Error('readAndSummarize: file not found: ' + file);

    const text = await ctx.fns.files.read(ctx, { path: file });
    const content = typeof text === 'string' ? text : String(text ?? '');
    const sliced = content.length > maxChars ? content.slice(0, maxChars) : content;

    const system = [
        'You read source material and return only a compact task-focused answer.',
        'Do not dump the file.',
        'Do not quote large passages.',
        'Answer briefly.',
    ].join(' ');

    const user = [
        'TASK:',
        task,
        '',
        'FILE:',
        file,
        '',
        'CONTENT:',
        sliced,
        '',
        content.length > sliced.length ? '[truncated; original chars=' + content.length + ']' : '',
    ].filter(Boolean).join('\n');

    const result = await ctx.fns.agent.llmCall(ctx, {
        agent,
        system,
        user,
        model,
    });

    return {
        file,
        summary: result.text,
        usage: result.usage,
    };
}
