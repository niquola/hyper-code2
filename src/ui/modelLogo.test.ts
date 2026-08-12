import { describe, expect, test } from 'bun:test';
import modelLogo from './modelLogo';

const ctx = { fns: { procs: { ui: { escape: ({ text }: any) => String(text).replaceAll('&', '&amp;').replaceAll('"', '&quot;') } } } } as any;
const render = (model: string, active = false, bare = false) => modelLogo(ctx, null, { model, active, bare });

describe('ui.modelLogo', () => {
    test('maps the configured providers to local SVG marks', () => {
        for (const model of ['codex:gpt-5.6-sol', 'claude-code:claude-haiku-4-5', 'kimi:kimi-k3']) {
            const html = render(model);
            expect(html).toContain('<svg');
            expect(html).toContain(`title="${model}"`);
            expect(html).toContain(`aria-label="Model: ${model}"`);
        }
    });

    test('rotates the mark only while active', () => {
        expect(render('codex:gpt-5.6-sol', true)).toContain('animate-spin');
        expect(render('codex:gpt-5.6-sol')).not.toContain('animate-spin');
    });

    test('can render without a frame for compact navigation', () => {
        const html = render('codex:gpt-5.6-sol', false, true);
        expect(html).not.toContain('border-gray-200');
        expect(html).not.toContain('bg-white');
    });

    test('uses a generic mark for an unknown provider', () => {
        expect(render('local:some-model')).toContain('ph-cpu');
    });
});
