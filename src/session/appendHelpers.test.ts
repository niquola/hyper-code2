import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

function seedAgent() {
  return { id: 'a1', model: 'm', systemPrompt: '', scratchpad: {}, messages: [], events: [], cursors: {}, subscribers: new Set<(ev: any, signal?: AbortSignal) => void>(), waiters: [], isStreaming: false, abortController: null, parentId: null, forkOffset: null };
}

describe('session append helpers', () => {
  test('append role-specific messages/events', async () => {
    const ctx: any = await mkTestCtx();
    ctx.fns.agent.renderEventHtml = async (_c: any, _s: any, _o: any) => '';
    ctx.fns.session.save({ agent: seedAgent() as any });
    await ctx.fns.session.appendUserMessage({ id: 'a1', text: 'u' });
    ctx.fns.session.appendAssistantMessage({ id: 'a1', msg: { content: 'a' } });

    await ctx.fns.session.appendThinkingEvent({ id: 'a1', text: '...' });
    await ctx.fns.session.appendToolCallEvent({ id: 'a1', payload: { name: 'evalCode', args: {}, result: '1', argsHtml: '', resultHtml: '', isError: false } });
    await ctx.fns.session.appendAssistantEvent({ id: 'a1', payload: { text: 'done', html: '<p>done</p>' } });
    await ctx.fns.session.appendErrorEvent({ id: 'a1', error: 'boom' });
    expect(ctx.fns.session.getMessages({ id: 'a1' }).map((m: any) => m.role)).toEqual(['user', 'assistant']);
    expect(ctx.fns.session.getEvents({ id: 'a1' }).map((e: any) => e.type)).toEqual(['user', 'thinking', 'tool_call', 'assistant', 'error']);
  });
});
