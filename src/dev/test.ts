export default async function (ctx: Context, opts: { files?: string[]; verbose?: boolean; maxFailures?: number; agent?: any } = {}) {
    const files = Array.isArray(opts.files) && opts.files.length > 0 ? opts.files : ['src'];
    const maxFailures = Number.isInteger(opts.maxFailures) ? Math.max(1, opts.maxFailures as number) : 3;
    await Bun.write('.hyper/_runtime/logs/.keep', '');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const logPath = '.hyper/_runtime/logs/test-' + ts + '.log';
    const args = ['bun', 'test', ...files];
    const proc = Bun.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    const text = [stdout, stderr].filter(Boolean).join('\n');
    await Bun.write(logPath, text);

    const lines = text.split(/\r?\n/);
    const pass = Number(/\b(\d+) pass\b/.exec(text)?.[1] ?? 0);
    const fail = Number(/\b(\d+) fail\b/.exec(text)?.[1] ?? 0);
    const summaryLine = lines.slice().reverse().find((line) => /\b\d+ pass\b|\b\d+ fail\b/.test(line)) || '';

    const failures: Array<{ file: string; test: string; message: string }> = [];
    for (let i = 0; i < lines.length && failures.length < maxFailures; i++) {
        const line = lines[i] ?? '';
        const m = /^\(fail\)\s+(.+?)(?:\s+\[[^\]]+\])?$/.exec(line.trim());
        if (!m) continue;
        const test = m[1] ?? '';
        let file = '';
        let message = '';
        for (let j = i - 1; j >= Math.max(0, i - 12); j--) {
            const t = lines[j]?.trim() ?? '';
            if (t.endsWith('.test.ts:')) { file = t.slice(0, -1); break; }
        }
        for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
            const t = lines[j]?.trim() ?? '';
            if (!t || t.startsWith('at ') || t.startsWith('(') || /^\d+\s*\|/.test(t)) continue;
            message = t;
            break;
        }
        failures.push({ file, test, message });
    }

    const a = opts.agent;
    if (a) {
        a.scratchpad ??= {};
        a.scratchpad.dev ??= {};
        a.scratchpad.dev.lastTestRun = { code, pass, fail, logPath, files, failures, summaryLine };
    }

    const result = { ok: code === 0, code, pass, fail, summaryLine, failures, logPath };
    if (!opts.verbose) return result;
    return {
        ...result,
        stdoutTail: stdout.split(/\r?\n/).slice(-80).join('\n'),
        stderrTail: stderr.split(/\r?\n/).slice(-80).join('\n'),
        totalStdoutLines: stdout ? stdout.split(/\r?\n/).length : 0,
        totalStderrLines: stderr ? stderr.split(/\r?\n/).length : 0,
    };
}
