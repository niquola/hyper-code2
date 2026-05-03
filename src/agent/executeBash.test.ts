import { describe, test, expect } from 'bun:test';
import executeBashFn from './executeBash';

const ctx: any = {};
const executeBash = (c: any, code: string) => executeBashFn(c, { code });

describe('agent.executeBash', () => {
    test('successful exit returns stdout', async () => {
        const r = await executeBash(ctx, 'echo hello');
        expect(r).toEqual({ output: 'hello', isError: false });
    });

    test('non-zero exit returns [exit N] + stderr', async () => {
        const r = await executeBash(ctx, 'echo oops 1>&2; exit 7');
        expect(r.isError).toBe(true);
        expect(r.output).toContain('[exit 7]');
        expect(r.output).toContain('oops');
    });

    test('non-zero exit with stdout includes both', async () => {
        const r = await executeBash(ctx, 'echo before; echo bad 1>&2; exit 1');
        expect(r.isError).toBe(true);
        expect(r.output).toContain('[exit 1]');
        expect(r.output).toContain('bad');
        expect(r.output).toContain('stdout:\nbefore');
    });

    test('empty output → "(no output)"', async () => {
        const r = await executeBash(ctx, 'true');
        expect(r).toEqual({ output: '(no output)', isError: false });
    });

    test('only stderr on success → "(stderr)" prefix', async () => {
        const r = await executeBash(ctx, 'echo only-err 1>&2');
        expect(r.isError).toBe(false);
        expect(r.output).toBe('(stderr)\nonly-err');
    });

    test('trailing newline trimmed from stdout', async () => {
        const r = await executeBash(ctx, 'printf "x\\n\\n"');
        expect(r.output).toBe('x');
    });
});
