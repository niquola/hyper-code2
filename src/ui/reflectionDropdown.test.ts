import { describe, expect, test } from 'bun:test';
import render from './reflectionDropdown';

const ctx = (active = false) => ({
    state: { reflectionRuns: active ? new Set(['a1']) : new Set() },
    fns: { procs: { ui: { escape: ({ text }: any) => String(text) } }, ui: { inplacePopup: async (opts: any) => `<button popovertarget="${opts.id}" ${opts.triggerAttrs}>${opts.triggerHtml}</button><div id="${opts.id}" popover class="inplace-popup-panel" ${opts.panelAttrs}>${opts.contentHtml}</div>` } },
}) as any;

const agent = (reflection?: any) => ({ id: 'a1', reflection: reflection ? { state: reflection } : undefined }) as any;

describe('ui.reflectionDropdown', () => {
    test('renders pending state as an icon only', async () => {
        const html = await render(ctx(), null, { agent: agent() });
        expect(html).toContain('ph-brain');
        expect(html).toContain('aria-label="Reflection pending"');
        expect(html).not.toContain('reflection pending</span>');
    });

    test('renders active state as a spinning icon only', async () => {
        const html = await render(ctx(true), null, { agent: agent() });
        expect(html).toContain('animate-spin');
        expect(html).toContain('aria-label="Reflection is running"');
        expect(html).not.toContain('reflecting…');
    });

    test('renders available reflection trigger as an anchored popover', async () => {
        const html = await render(ctx(), null, { agent: agent({ activity: {}, tasks: [], userSatisfaction: {}, mistakes: [] }) });
        expect(html).toContain('popovertarget="reflection-popover-a1"');
        expect(html).toContain('id="reflection-popover-a1"');
        expect(html).toContain('class="inplace-popup-panel"');
        expect(html).toContain('aria-label="Open conversation reflection"');
        expect(html).not.toContain('> reflection</summary>');
    });
    test('renders a dismiss control for reflection nudge', async () => {
        const html = await render(ctx(), null, { agent: agent({ activity: {}, tasks: [], userSatisfaction: {}, mistakes: [], reflectionNudge: { text: 'verify first', expiresAfterTurns: 2 } }) });
        expect(html).toContain('reflection-nudge/delete');
        expect(html).toContain('aria-label="Dismiss reflection nudge"');
        expect(html).toContain('px-3 py-2.5');
    });



    // A model that was asked for a list of reasons can answer with a sentence.
    // The stored row keeps that shape forever, and rendering it must not take
    // the agent page down with ".map is not a function".
    test('survives a string where a list was promised', async () => {
        const html = await render(ctx(), null, { agent: agent({
            activity: {}, tasks: 'just started', mistakes: 'none so far',
            userSatisfaction: { level: 'satisfied', trend: 'stable', reasons: 'the user said thanks' },
        }) });
        expect(html).toContain('the user said thanks');
        expect(html).toContain('just started');
    });
});
