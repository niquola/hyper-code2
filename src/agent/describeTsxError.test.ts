import { describe, test, expect } from 'bun:test';
import describeTsxError from './describeTsxError';

describe('agent.describeTsxError', () => {
    test('plain Error without position', () => {
        const out = describeTsxError(new Error('boom'), '<div/>');
        expect(out).toContain('boom');
        expect(out).toContain('body:\n<div/>');
        expect(out).not.toContain('at line');
    });

    test('error with position info from Bun.Transpiler', () => {
        const e: any = new Error('Unexpected token');
        e.position = { line: 3, column: 5, lineText: '  <div<' };
        const out = describeTsxError(e, '<div/>');
        expect(out).toContain('Unexpected token');
        expect(out).toContain('at line 3, col 5: <div<');
    });

    test('long body is truncated to 800 chars + suffix', () => {
        const body = 'x'.repeat(2000);
        const out = describeTsxError(new Error('e'), body);
        expect(out).toContain('…(+1200 chars)');
        expect(out.split('body:\n')[1]!.length).toBeLessThan(900);
    });

    test('non-Error inputs fall back to String(e)', () => {
        const out = describeTsxError('weird', 'b');
        expect(out).toContain('weird');
    });

    test('empty-string error message becomes "unknown error"', () => {
        const out = describeTsxError({ message: '' }, 'b');
        expect(out).toContain('unknown error');
    });
});
