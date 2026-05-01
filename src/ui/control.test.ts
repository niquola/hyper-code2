import { describe, test, expect } from 'bun:test';
import createAgent from './createAgent';
import sendToAgent from './sendToAgent';
import notify from './notify';
import openFile from './openFile';

const mkCtx = () => ({
  env: {},
  state: { agent: {} },
  fns: {
    agent: {
      start(ctx: any, opts: any) {
        const agent = { id: 'test', model: opts.model, systemPrompt: opts.systemPrompt, tools: opts.tools, events: [], messages: [], scratchpad: {}, isStreaming: false };
        ctx.state.agent[agent.id] = agent;
        return agent;
      },
      async systemPrompt() { return 'default system'; },
      async run(_ctx: any, agent: any, text: string) {
        agent.events.push({ type: 'assistant', text: 'ok:' + text });
      },
    },
    session: { save() {} },
    events: { emit(_ctx: any, ev: any) { ((_ctx.state as any).emitted ??= []).push(ev); } },
    files: {
      async resolveSafe(_ctx: any, path: string) { return path; },
      open(_ctx: any, path: string) { ((_ctx.state as any).openedFiles ??= []).push(path); },
    },
  },
}) as unknown as Context;

describe('ui control helpers', () => {
  test('createAgent creates and optionally opens agent', async () => {
    const ctx: any = mkCtx();
    const res = await createAgent(ctx, { model: 'x:test', open: true });
    expect(res.id).toBe('test');
    expect(ctx.state.emitted[0]).toEqual({ type: 'ui.navigate', path: '/agent/test' });
  });

  test('sendToAgent queues run and emits navigate when requested', async () => {
    const ctx: any = mkCtx();
    const agent = ctx.fns.agent.start(ctx, { model: 'x:test', systemPrompt: '', tools: [] });
    const res = await sendToAgent(ctx, { agentId: agent.id, text: 'hello', open: true });
    expect(res.agentId).toBe(agent.id);
    expect(ctx.state.emitted[0]).toEqual({ type: 'ui.navigate', path: '/agent/test' });
  });

  test('notify emits ui.notify event', async () => {
    const ctx: any = mkCtx();
    await notify(ctx, { text: 'hi', level: 'warn' });
    expect(ctx.state.emitted[0].type).toBe('ui.notify');
  });

  test('openFile resolves and opens file', async () => {
    const ctx: any = mkCtx();
    const res = await openFile(ctx, 'src/x.ts');
    expect(res.opened).toBe('src/x.ts');
    expect(ctx.state.openedFiles).toEqual(['src/x.ts']);
  });
});
