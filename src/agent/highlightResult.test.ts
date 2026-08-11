import { describe, test, expect } from 'bun:test';
import highlightResultFn from './highlightResult';
const highlightResult = (ctx: any, output: string) => highlightResultFn(ctx, null, { output });

function mkCtx() {
    const calls: { code: string; lang: string }[] = [];
    // Plain-object ctx (no injecting Proxy) — the stub receives opts directly.
    const ctx: any = {
        fns: {
            markdown: {
                highlight: async (opts: { code: string; lang: string }) => {
                    calls.push({ code: opts.code, lang: opts.lang });
                    return `<${opts.lang}>${opts.code}</${opts.lang}>`;
                },
            },
        },
    };
    return { ctx, calls };
}

describe('agent.highlightResult', () => {
    test('JSON object is pretty-printed and highlighted as json', async () => {
        const { ctx, calls } = mkCtx();
        const out = await highlightResult(ctx, '{"a":1,"b":2}');
        expect(calls).toHaveLength(1);
        expect(calls[0]!.lang).toBe('json');
        expect(calls[0]!.code).toBe('{\n  "a": 1,\n  "b": 2\n}');
        expect(out).toContain('<json>');
    });

    test('JSON array also handled', async () => {
        const { ctx, calls } = mkCtx();
        await highlightResult(ctx, '[1,2,3]');
        expect(calls[0]!.lang).toBe('json');
    });

    test('malformed JSON falls back to the caller-declared language', async () => {
        const { ctx, calls } = mkCtx();
        await highlightResult(ctx, '{not real json');
        expect(calls[0]!.lang).toBe('text');
        expect(calls[0]!.code).toBe('{not real json');
    });

    test('plain text stays plain — colouring prose as code is worse than not colouring it', async () => {
        const { ctx, calls } = mkCtx();
        await highlightResult(ctx, 'hello world');
        expect(calls[0]!.lang).toBe('text');
    });

    test('whitespace-trim aware (leading whitespace before {)', async () => {
        const { ctx, calls } = mkCtx();
        await highlightResult(ctx, '   {"a":1}   ');
        expect(calls[0]!.lang).toBe('json');
    });
});
