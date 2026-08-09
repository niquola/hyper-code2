import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

function seedAgent() {
  return { id: 'a1', model: 'm', systemPrompt: '', scratchpad: {}, messages: [], events: [], cursors: {}, subscribers: new Set<(ev: any, signal?: AbortSignal) => void>(), waiters: [], isStreaming: false, abortController: null, parentId: null, forkOffset: null };
}

describe('session.replaceMessages / replaceEvents', () => {
  test('replaces full message list', async () => {
    const ctx: any = await mkTestCtx();
    ctx.fns.session.save({ agent: seedAgent() as any });
    ctx.fns.session.replaceMessages({ id: 'a1', messages: [{ role: 'user', content: 'x' }, { role: 'assistant', content: 'y' }] });
    ctx.fns.session.replaceMessages({ id: 'a1', messages: [{ role: 'user', content: 'z' }] });
    expect(ctx.fns.session.getMessages({ id: 'a1' }).map((m: any) => m.content)).toEqual(['z']);
  });

  test('replaces full event list', async () => {
    const ctx: any = await mkTestCtx();
    ctx.fns.session.save({ agent: seedAgent() as any });
    ctx.fns.session.replaceEvents({ id: 'a1', events: [{ type: 'user', text: 'x' }, { type: 'assistant', text: 'y' }] });
    ctx.fns.session.replaceEvents({ id: 'a1', events: [{ type: 'assistant', text: 'z' }] });
    expect(ctx.fns.session.getEvents({ id: 'a1' }).map((e: any) => e.text)).toEqual(['z']);
  });
});
