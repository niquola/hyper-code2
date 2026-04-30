export default async function (_ctx: Context, opts: { path?: string; run?: 'last'; tail?: number; agent?: any } = {}) {
    const path = opts.path || (opts.run === 'last' ? opts.agent?.scratchpad?.dev?.lastTestRun?.logPath : null);
    if (!path) throw new Error('no log path');
    const text = await Bun.file(path).text();
    const lines = text.split(/\r?\n/);
    const tail = Number.isInteger(opts.tail) ? Math.max(1, opts.tail as number) : 80;
    return { path, text: lines.slice(-tail).join('\n'), totalLines: lines.length };
}
