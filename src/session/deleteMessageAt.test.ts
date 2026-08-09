import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

function seedAgent() {
  return { id: 'a1', model: 'm', systemPrompt: '', scratchpad: {}, messages: [], events: [], cursors: {}, subscribers: new Set<(ev: any, signal?: AbortSignal) => void>(), waiters: [], isStreaming: false, abortController: null, parentId: null, forkOffset: null };
}

describe('delete message operations', () => {
  test('deletes a plain message by idx', async () => {
    const ctx: any = await mkTestCtx(); await ctx.fns.session.save({ agent: seedAgent() as any });
    await ctx.fns.session.replaceMessages({ id: 'a1', messages: [{ role: 'user', content: 'u1' }, { role: 'assistant', content: 'a1' }, { role: 'user', content: 'u2' }] });
    expect((await ctx.fns.session.deleteMessageAt({ id: 'a1', idx: 1 })).ok).toBe(true);
    expect((await ctx.fns.session.getMessages({ id: 'a1' })).map((m: any) => m.content)).toEqual(['u1', 'u2']);
  });

  test('rejects deleting markers half-pair: assistant §eval alone', async () => {
    const ctx: any = await mkTestCtx(); await ctx.fns.session.save({ agent: seedAgent() as any });
    await ctx.fns.session.replaceMessages({ id: 'a1', messages: [
      { role: 'user',      content: 'go' },
      { role: 'assistant', content: '§eval\nconsole.log(1);' },
      { role: 'user',      content: '§result:eval\n1' },
      { role: 'assistant', content: 'done' },
    ] });
    expect((await ctx.fns.session.deleteMessageAt({ id: 'a1', idx: 1 })).ok).toBe(false);
    expect((await ctx.fns.session.deleteMessageAt({ id: 'a1', idx: 2 })).ok).toBe(false);
    // Plain user/assistant still deletable.
    expect((await ctx.fns.session.deleteMessageAt({ id: 'a1', idx: 3 })).ok).toBe(true);
  });

  test('rejects deleting markers half-pair: assistant §write alone', async () => {
    const ctx: any = await mkTestCtx(); await ctx.fns.session.save({ agent: seedAgent() as any });
    await ctx.fns.session.replaceMessages({ id: 'a1', messages: [
      { role: 'user',      content: 'create a file' },
      { role: 'assistant', content: '§write:src/foo.ts\nexport default 1;' },
      { role: 'user',      content: '§result:write:src/foo.ts\nwrote ...' },
    ] });
    expect((await ctx.fns.session.deleteMessageAt({ id: 'a1', idx: 1 })).ok).toBe(false);
    expect((await ctx.fns.session.deleteMessageAt({ id: 'a1', idx: 2 })).ok).toBe(false);
  });

  test('truncate from walks back over markers pair (user-result)', async () => {
    const ctx: any = await mkTestCtx(); await ctx.fns.session.save({ agent: seedAgent() as any });
    await ctx.fns.session.replaceMessages({ id: 'a1', messages: [
      { role: 'user',      content: 'go' },
      { role: 'assistant', content: '§eval\nconsole.log(1);' },
      { role: 'user',      content: '§result:eval\n1' },
      { role: 'assistant', content: 'done' },
    ] });
    // User asks "delete from idx 2 (the result)" — must walk back to idx 1
    // (the marker assistant) so we don't leave an orphan §eval.
    const res = await ctx.fns.session.truncateMessagesFrom({ id: 'a1', from: 2 });
    expect(res.ok).toBe(true);
    expect(res.from).toBe(1);
    expect((await ctx.fns.session.getMessages({ id: 'a1' })).map((m: any) => m.content)).toEqual(['go']);
  });

  test('truncate from walks back over markers pair (assistant-marker)', async () => {
    const ctx: any = await mkTestCtx(); await ctx.fns.session.save({ agent: seedAgent() as any });
    await ctx.fns.session.replaceMessages({ id: 'a1', messages: [
      { role: 'user',      content: 'go' },
      { role: 'assistant', content: 'doing it' },
      { role: 'assistant', content: '§eval\nconsole.log(1);' },
      { role: 'user',      content: '§result:eval\n1' },
    ] });
    // "delete from idx 3 (the result)" — walk back over the result, but
    // STOP at the marker (idx 2 stays as boundary, since prev (idx 1) is
    // a plain assistant, not a half-pair).
    // Expected: the result and its marker disappear, prose assistant survives.
    const res = await ctx.fns.session.truncateMessagesFrom({ id: 'a1', from: 3 });
    expect(res.ok).toBe(true);
    expect(res.from).toBe(2);
    expect((await ctx.fns.session.getMessages({ id: 'a1' })).map((m: any) => m.content)).toEqual(['go', 'doing it']);
  });

  test('truncate from on plain assistant does not walk back', async () => {
    const ctx: any = await mkTestCtx(); await ctx.fns.session.save({ agent: seedAgent() as any });
    await ctx.fns.session.replaceMessages({ id: 'a1', messages: [
      { role: 'user',      content: 'q' },
      { role: 'assistant', content: 'a' },
      { role: 'user',      content: 'q2' },
      { role: 'assistant', content: 'a2' },
    ] });
    const res = await ctx.fns.session.truncateMessagesFrom({ id: 'a1', from: 3 });
    expect(res.ok).toBe(true);
    expect(res.from).toBe(3);
    expect((await ctx.fns.session.getMessages({ id: 'a1' })).map((m: any) => m.content)).toEqual(['q', 'a', 'q2']);
  });
});

// The bug the user hit: delete only touched messages, so the chat bubble
// (rendered from the events table) never disappeared. Delete must remove the
// matching event too.
describe('deleteMessageAt removes the rendered event in lockstep', () => {
  test('deleting a user message deletes its event, keeps others', async () => {
    const ctx = await mkTestCtx();
    const id = (await ctx.fns.agent.start({ model: 'mock:x' })).id;
    await ctx.fns.session.appendMessage({ id, message: { role: 'user', content: 'hello' } });   // 0
    await ctx.fns.session.appendMessage({ id, message: { role: 'assistant', content: 'hi' } });  // 1
    await ctx.fns.session.appendEvent({ id, event: { type: 'user', text: 'hello', messageIdx: 0 } });
    await ctx.fns.session.appendEvent({ id, event: { type: 'assistant', text: 'hi', messageIdx: 1 } });

    expect(await ctx.fns.session.deleteMessageAt({ id, idx: 0 })).toEqual({ ok: true });
    // message gone
    expect((await ctx.fns.session.getMessages({ id })).map((m: any) => m.content)).toEqual(['hi']);
    // its event gone too — only the assistant bubble survives
    const evs = await ctx.fns.session.getEvents({ id });
    expect(evs.map((e: any) => e.messageIdx)).toEqual([1]);
  });
});
