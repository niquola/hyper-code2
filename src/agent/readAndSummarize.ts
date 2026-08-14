/**
 * Reads a potentially large file and returns a task-focused LLM summary.
 *
 * Use this instead of injecting a large document into the main agent context.
  * @param opts.agent Agent whose state is read or updated.
 * @param opts.file Source file path.
 * @param opts.task Concise task to assign or perform.
 * @param opts.maxChars Maximum source characters to include.
 * @param opts.model Model identifier to use.
*/

export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {

        /** Agent and model context used for the summarization call. */
        agent: types.agent.Agent;

        /** Workspace-relative or absolute source file. */
        file: string;

        /** Question the summary should answer. */
        task: string;

        /** Maximum source characters sent to the model. @default 120000 @minimum 1 */
        maxChars?: number;

        /** Optional model override. */
        model?: string;
    },
): Promise<{ file: string; summary: string; usage: any }> {
    const { agent } = opts;
    const file = String(opts?.file ?? '').trim();
    const task = String(opts?.task ?? '').trim();
    const maxChars = Number(opts?.maxChars ?? 120000);
    const model = opts?.model ? String(opts.model) : undefined;

    if (!file) throw new Error('readAndSummarize: file is required');
    if (!task) throw new Error('readAndSummarize: task is required');

    const exists = await ctx.fns.files.exists({ path: file });
    if (!exists) throw new Error('readAndSummarize: file not found: ' + file);

    const text = await ctx.fns.files.read({ path: file });
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

    const result = await ctx.fns.agent.llmCall({
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
