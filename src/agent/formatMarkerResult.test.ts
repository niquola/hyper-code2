import { describe, test, expect } from 'bun:test';
import formatMarkerResultFn from './formatMarkerResult';
const formatMarkerResult = (call: any, output: string, isError: boolean) =>
    formatMarkerResultFn(null as any, { call, output, isError });

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

    test('read plain', () => {
        const out = formatMarkerResult({ kind: 'read', path: 'src/x.ts', format: 'plain' }, 'body', false);
        expect(out).toBe('§result:read:src/x.ts\nbody');
    });

    test('read hashline', () => {
        const out = formatMarkerResult({ kind: 'read', path: 'src/x.ts', format: 'hashline' }, '1aa|body', false);
        expect(out).toBe('§result:read:hashline:src/x.ts\n1aa|body');
    });

    test('grep plain', () => {
        const out = formatMarkerResult({ kind: 'grep', format: 'plain', content: '' }, 'a.ts:2:3|foo', false);
        expect(out).toBe('§result:grep\na.ts:2:3|foo');
    });

    test('grep hashline', () => {
        const out = formatMarkerResult({ kind: 'grep', format: 'hashline', content: '' }, 'a.ts:2aa:3|foo', false);
        expect(out).toBe('§result:grep:hashline\na.ts:2aa:3|foo');
    });

    test('edit hashline', () => {
        const out = formatMarkerResult({ kind: 'edit', format: 'hashline', content: '' }, 'edited a.ts (12 bytes)', false);
        expect(out).toBe('§result:edit:hashline\nedited a.ts (12 bytes)');
    });

    test('edit hashline error', () => {
        const out = formatMarkerResult({ kind: 'edit', format: 'hashline', content: '' }, 'stale anchor', true);
        expect(out).toBe('§result:edit:hashline:error\nstale anchor');
    });
});