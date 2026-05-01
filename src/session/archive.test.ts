import { describe, test, expect } from "bun:test";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "./save";
import appendUserMessage from "./appendUserMessage";
import appendMessage from "./appendMessage";
import appendEvent from "./appendEvent";
import list from "./list";
import archive from "./archive";
import load from "./load";
import start from "../agent/start";
import nextId from "../agent/nextId";

describe('session.archive', () => {
    test('archived session disappears from list and cannot be loaded', async () => {
        const dbPath = '.hyper/_runtime/test-archive-' + Date.now() + '.sqlite';
        const ctx: any = { state: {}, env: {}, fns: { db: { connect, migrate, select: (await import('../db/select')).default, exec: (await import('../db/exec')).default }, session: { save, list, archive, load, appendUserMessage, appendMessage, appendEvent }, agent: { start, nextId, renderEventHtml: async () => '' }, events: { emitAgentsChanged: () => {} } } };
        ctx.fns.db.connect(ctx, dbPath);
        await ctx.fns.db.migrate(ctx);
        const agent = ctx.fns.agent.start(ctx, { model: 'test:model', systemPrompt: '', tools: [] });
        save(ctx, agent);
        await appendUserMessage(ctx, agent.id, 'hello archive');
        expect(list(ctx).some((a: any) => a.id === agent.id)).toBe(true);
        expect(archive(ctx, agent.id).ok).toBe(true);
        expect(list(ctx).some((a: any) => a.id === agent.id)).toBe(false);
        expect(load(ctx, agent.id)).toBeNull();
    });
});
