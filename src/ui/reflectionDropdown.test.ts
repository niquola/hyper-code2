import { describe, expect, test } from 'bun:test';
import render from './reflectionDropdown';

const ctx = (active = false) => ({
    state: { reflectionRuns: active ? new Set(['a1']) : new Set() },
    fns: { procs: { ui: { escape: ({ text }: any) => String(text) } } },
}) as any;

const agent = (reflection?: any) => ({ id: 'a1', reflection: reflection ? { state: reflection } : undefined }) as any;

describe('ui.reflectionDropdown', () => {
    test('renders pending state as an icon only', () => {
        const html = render(ctx(), null, { agent: agent() });
        expect(html).toContain('ph-brain');
        expect(html).toContain('aria-label="Reflection pending"');
        expect(html).not.toContain('reflection pending</span>');
    });

    test('renders active state as a spinning icon only', () => {
        const html = render(ctx(true), null, { agent: agent() });
        expect(html).toContain('animate-spin');
        expect(html).toContain('aria-label="Reflection is running"');
        expect(html).not.toContain('reflecting…');
    });

    test('renders available reflection trigger as an icon only', () => {
        const html = render(ctx(), null, { agent: agent({ activity: {}, tasks: [], userSatisfaction: {}, mistakes: [] }) });
        expect(html).toContain('<summary');
        expect(html).toContain('aria-label="Open conversation reflection"');
        expect(html).not.toContain('> reflection</summary>');
    });
    test('renders a dismiss control for reflection nudge', () => {
        const html = render(ctx(), null, { agent: agent({ activity: {}, tasks: [], userSatisfaction: {}, mistakes: [], reflectionNudge: { text: 'verify first', expiresAfterTurns: 2 } }) });
        expect(html).toContain('reflection-nudge/delete');
        expect(html).toContain('aria-label="Dismiss reflection nudge"');
        expect(html).toContain('px-3 py-2.5');
    });


});
