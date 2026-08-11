import { describe, test, expect } from 'bun:test';
import toolLang from './toolLang';

const lang = (name: string, args: any, part: 'args' | 'result') =>
    toolLang(null as any, null, { name, args, part });

describe('agent.toolLang', () => {
    test('a read is highlighted in the language of the file it read', () => {
        expect(lang('read', { path: 'src/a.ts' }, 'result')).toBe('typescript');
        expect(lang('read', { path: 'script.py' }, 'result')).toBe('python');
        expect(lang('read', { path: 'notes.md' }, 'result')).toBe('markdown');
        expect(lang('read', { path: 'Dockerfile' }, 'result')).toBe('dockerfile');
        expect(lang('read', { path: 'data.unknown' }, 'result')).toBe('text');
    });

    test('a write body is the file, an eval is TypeScript, a bash is shell', () => {
        expect(lang('write', { path: 'a.py' }, 'args')).toBe('python');
        expect(lang('eval', { code: 'x' }, 'args')).toBe('typescript');
        expect(lang('bash', { command: 'ls' }, 'args')).toBe('bash');
    });

    test('output that is not code stays text, arguments that are not code stay JSON', () => {
        expect(lang('bash', { command: 'ls' }, 'result')).toBe('text');
        expect(lang('grep', { pattern: 'x' }, 'result')).toBe('text');
        expect(lang('grep', { pattern: 'x' }, 'args')).toBe('json');
        expect(lang('edit', { path: 'a.ts' }, 'args')).toBe('json');
    });
});
