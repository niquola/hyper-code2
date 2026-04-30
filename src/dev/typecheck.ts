export default async function (ctx: Context, opts: { files?: string[]; verbose?: boolean; agent?: any } = {}) {
    await Bun.write('.hyper/_runtime/logs/.keep', '');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const logPath = '.hyper/_runtime/logs/typecheck-' + ts + '.log';
    const targets = Array.isArray(opts.files) && opts.files.length > 0 ? opts.files : ['--noEmit'];
    const useProject = targets.some(x => x === '-p' || x === '--project') || targets.some(x => x.endsWith('.json'));
    const args = ['bun', 'x', 'tsc', ...(useProject ? [] : ['--noEmit']), ...targets];
    const proc = Bun.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    const text = [stdout, stderr].filter(Boolean).join('\n');
    await Bun.write(logPath, text);
    const lines = text.split(/\r?\n/).filter(Boolean);
    const diagnostics = lines.filter(l => /error TS\d+:|^error:|^Found \d+ errors?/.test(l)).slice(0, 20);
    const summaryLine = lines.slice().reverse().find(l => /Found \d+ errors?/.test(l)) || (code === 0 ? 'typecheck ok' : 'typecheck failed');
    const result = { ok: code === 0, code, summaryLine, diagnostics, logPath };
    const a = opts.agent;
    if (a) {
        a.scratchpad ??= {};
        a.scratchpad.dev ??= {};
        a.scratchpad.dev.lastTypecheckRun = result;
    }
    if (!opts.verbose) return result;
    return {
        ...result,
        stdoutTail: stdout.split(/\r?\n/).slice(-80).join('\n'),
        stderrTail: stderr.split(/\r?\n/).slice(-80).join('\n'),
        totalStdoutLines: stdout ? stdout.split(/\r?\n/).length : 0,
        totalStderrLines: stderr ? stderr.split(/\r?\n/).length : 0,
    };
}
