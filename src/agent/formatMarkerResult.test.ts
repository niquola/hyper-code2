import { describe, test, expect } from 'bun:test';
import formatMarkerResult from './formatMarkerResult';

describe('agent.formatMarkerResult', () => {
    test('eval success', () => {
        const out = formatMarkerResult({ kind: 'eval', content: '' }, '4', false);
        expect(out).toBe('§result:eval\n4');
    });

    test('eval error marks status', () => {
        const out = formatMarkerResult({ kind: 'eval', content: '' }, 'TypeError: x', true);
        expect(out).toBe('§result:eval:error\nTypeError: x');
    });

    test('write success keeps path', () => {
        const out = formatMarkerResult({ kind: 'write', path: 'src/foo.ts', content: '' }, 'ok 42 bytes', false);
        expect(out).toBe('§result:write:src/foo.ts\nok 42 bytes');
    });

    test('write error', () => {
        const out = formatMarkerResult({ kind: 'write', path: '/forbidden', content: '' }, 'EACCES', true);
        expect(out).toBe('§result:write:/forbidden:error\nEACCES');
    });

    test('bash success', () => {
        const out = formatMarkerResult({ kind: 'bash', content: '' }, 'hello', false);
        expect(out).toBe('§result:bash\nhello');
    });

    test('bash error', () => {
        const out = formatMarkerResult({ kind: 'bash', content: '' }, '[exit 1]\noops', true);
        expect(out).toBe('§result:bash:error\n[exit 1]\noops');
    });
});
