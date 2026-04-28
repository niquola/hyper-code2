export default async function (_ctx: Context, run: 'last' | { path: string }, opts: { agent?: any } = {}) {
    const meta = run === 'last' ? opts.agent?.scratchpad?.dev?.lastTestRun : null;
    const path = run === 'last' ? meta?.logPath : run.path;
    if (!path) throw new Error('no test run available');
    const text = await Bun.file(path).text();
    const pass = Number(/\b(\d+) pass\b/.exec(text)?.[1] ?? 0);
    const fail = Number(/\b(\d+) fail\b/.exec(text)?.[1] ?? 0);
    const lines = text.split(/\r?\n/);
    const failedTests = lines.filter(l => l.trim().startsWith('(fail) ')).map(l => l.trim().replace(/^\(fail\)\s+/, ''));
    return { path, ok: fail === 0, pass, fail, failedTests: failedTests.slice(0, 10) };
}
