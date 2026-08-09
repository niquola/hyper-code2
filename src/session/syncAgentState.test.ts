import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

function baseAgent(id: string, extra: any = {}) {
  return { id, model: 'm', systemPrompt: '', scratchpad: {}, messages: [], events: [], cursors: {}, subscribers: new Set<(ev: any, signal?: AbortSignal) => void>(), waiters: [], isStreaming: false, abortController: null, parentId: extra.parentId ?? null, forkOffset: extra.forkOffset ?? null };
}

describe('session.syncAgentState', () => {
  test('syncs root agent from db messages/events', async () => {
    const ctx: any = await mkTestCtx();
    const a = baseAgent('a1');
    ctx.fns.session.save({ agent: a });
    ctx.fns.session.appendMessage({ id: 'a1', message: { role: 'user', content: 'hi' } });
    ctx.fns.session.appendEvent({ id: 'a1', event: { type: 'user', text: 'hi' } });
    a.messages = []; a.events = [];
    ctx.fns.session.syncAgentState({ agent: a });
    expect(a.messages.map((m: any) => m.content)).toEqual(['hi']);
    expect(a.events.map((e: any) => e.text)).toEqual(['hi']);
  });

  test('syncs fork agent from full inherited transcript', async () => {
    const ctx: any = await mkTestCtx();
    ctx.fns.session.save({ agent: baseAgent('parent') });
    ctx.fns.session.appendMessage({ id: 'parent', message: { role: 'user', content: 'parent hi' } });
    ctx.fns.session.save({ agent: baseAgent('child', { parentId: 'parent', forkOffset: 1 }) });
    ctx.fns.session.appendMessage({ id: 'child', message: { role: 'user', content: 'child hi' } });
    const child = baseAgent('child', { parentId: 'parent', forkOffset: 1 });
    ctx.fns.session.syncAgentState({ agent: child });
    expect(child.messages.map((m: any) => m.content)).toEqual(['parent hi', 'child hi']);
  });
});
