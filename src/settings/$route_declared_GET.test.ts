import { describe, test, expect } from 'bun:test';
import { mkTestCtx } from '../_testCtx.entry';
import getRoute from './$route_declared_GET';
import postRoute from './$route_declared_POST';

describe('GET/POST /settings/declared', () => {
    test('GET renders form with all declared settings', async () => {
        const ctx = await mkTestCtx();
        const out: any = await getRoute(ctx);
        expect(out.title).toBe('settings');
        expect(out.main).toContain('declared settings');
        expect(out.main).toContain('lmstudioBaseUrl');
        expect(out.main).toContain('defaultModel');
        expect(out.main).toContain('debounceMs');
        expect(out.main).toContain('hx-post="/settings/declared"');
    });

    test('source badges in GET output match resolution chain', async () => {
        const ctx = await mkTestCtx();
        ctx.env.LMSTUDIO_URL = 'http://env-host:1234';
        ctx.fns.settings.set(ctx, {
            module: 'llm', scopeType: 'global', key: 'defaultModel', value: 'kimi:k2',
        });

        const out: any = await getRoute(ctx);
        // env-sourced
        expect(out.main).toMatch(/env: LMSTUDIO_URL/);
        // db-sourced
        expect(out.main).toMatch(/>db</);
    });

    test('POST writes form values via settings.set', async () => {
        const ctx = await mkTestCtx();
        const fd = new FormData();
        fd.set('llm.defaultModel', 'openai:gpt-4o-mini');
        fd.set('agent.debounceMs', '1500');
        const req = new Request('http://x/settings/declared', { method: 'POST', body: fd });

        const res = await postRoute(ctx, null, req);
        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body).toContain('settings-form');

        expect(ctx.fns.settings.get(ctx, { module: 'llm', scopeType: 'global', key: 'defaultModel' }))
            .toBe('openai:gpt-4o-mini');
        expect(ctx.fns.settings.get(ctx, { module: 'agent', scopeType: 'global', key: 'debounceMs' }))
            .toBe(1500);
    });

    test('POST with reset=<key> removes the row', async () => {
        const ctx = await mkTestCtx();
        ctx.fns.settings.set(ctx, {
            module: 'llm', scopeType: 'global', key: 'defaultModel', value: 'kimi:k2',
        });
        expect(ctx.fns.settings.get(ctx, { module: 'llm', scopeType: 'global', key: 'defaultModel' }))
            .toBe('kimi:k2');

        const fd = new FormData();
        fd.set('reset', 'llm.defaultModel');
        const req = new Request('http://x/settings/declared', { method: 'POST', body: fd });
        await postRoute(ctx, null, req);

        // Now falls back to declared default.
        expect(ctx.fns.settings.get(ctx, { module: 'llm', scopeType: 'global', key: 'defaultModel' }))
            .toBe('minimax/minimax-m2.7');
    });

    test('POST validates enum and silently ignores bad values', async () => {
        const ctx = await mkTestCtx();
        const fd = new FormData();
        fd.set('llm.defaultModel', 'made-up-model-not-in-options');
        const req = new Request('http://x/settings/declared', { method: 'POST', body: fd });
        await postRoute(ctx, null, req);

        // Bad enum was rejected — value stays at default.
        expect(ctx.fns.settings.get(ctx, { module: 'llm', scopeType: 'global', key: 'defaultModel' }))
            .toBe('minimax/minimax-m2.7');
    });

    test('POST validates number bounds and ignores NaN', async () => {
        const ctx = await mkTestCtx();
        const fd = new FormData();
        fd.set('agent.debounceMs', 'not-a-number');
        const req = new Request('http://x/settings/declared', { method: 'POST', body: fd });
        await postRoute(ctx, null, req);

        expect(ctx.fns.settings.get(ctx, { module: 'agent', scopeType: 'global', key: 'debounceMs' }))
            .toBe(1000);
    });
});
