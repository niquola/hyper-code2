import { describe, test, expect } from 'bun:test';
import renderTsx from './renderTsx';

const ctx: any = { fns: {}, state: { db: null } };
const agent: any = { id: 'a', scratchpad: { greeting: 'hi' } };

describe('agent.renderTsx', () => {
    test('plain HTML fragment passes through', () => {
        const out = renderTsx(ctx, '<div class="card">hi</div>', agent);
        expect(out).toBe('<div class="card">hi</div>');
    });

    test('multiple top-level siblings via implicit Fragment wrap', () => {
        const out = renderTsx(ctx, '<p>a</p><p>b</p>', agent);
        expect(out).toBe('<p>a</p><p>b</p>');
    });

    test('void tags self-close', () => {
        const out = renderTsx(ctx, '<img src="/x.png"/>', agent);
        expect(out).toBe('<img src="/x.png"/>');
    });

    test('text content is HTML-escaped', () => {
        const out = renderTsx(ctx, '<p>{"<script>"}</p>', agent);
        expect(out).toBe('<p>&lt;script&gt;</p>');
    });

    test('attribute values are HTML-escaped', () => {
        const out = renderTsx(ctx, '<a title={\'a"b\'}>x</a>', agent);
        expect(out).toContain('title="a&quot;b"');
    });

    test('agent is in scope inside {expr}', () => {
        const out = renderTsx(ctx, '<p>{agent.scratchpad.greeting}</p>', agent);
        expect(out).toBe('<p>hi</p>');
    });

    test('ctx is in scope inside {expr}', () => {
        const c: any = { fns: {}, state: { who: 'world' } };
        const out = renderTsx(c, '<p>hello {ctx.state.who}</p>', agent);
        expect(out).toBe('<p>hello world</p>');
    });

    test('boolean attribute true → bare attr', () => {
        const out = renderTsx(ctx, '<input disabled={true}/>', agent);
        expect(out).toBe('<input disabled/>');
    });

    test('false attribute is omitted', () => {
        const out = renderTsx(ctx, '<input disabled={false}/>', agent);
        expect(out).toBe('<input/>');
    });

    test('parse error throws', () => {
        expect(() => renderTsx(ctx, '<div><', agent)).toThrow();
    });
});
