// Centralised test context. Avoids hand-rewriting mkCtx in every test.
// `.entry.ts` suffix is skipped by the project scanner (see project/classify.ts),
// so this file is NOT auto-registered as a ctx.fns.testCtx.<x> function.
//
// Usage:
//   import { mkTestCtx } from '../_testCtx.entry';
//   const ctx = await mkTestCtx();         // :memory: db, migrations applied
//   const agent = ctx.fns.agent.start(ctx, { model: 'mock:echo' });
//
// Override or add fns by mutating ctx.fns after construction.
import connect from './db/connect';
import migrate from './db/migrate';
import dbExec from './db/exec';
import dbSelect from './db/select';
import dbInsert from './db/insert';

import save from './session/save';
import load from './session/load';
import list from './session/list';
import archiveSession from './session/archive';
import deleteSession from './session/delete';
import fork from './session/fork';
import loadAll from './session/loadAll';
import search from './session/search';
import appendMessage from './session/appendMessage';
import appendEvent from './session/appendEvent';
import appendUserMessage from './session/appendUserMessage';
import appendAssistantMessage from './session/appendAssistantMessage';
import appendToolMessage from './session/appendToolMessage';
import appendThinkingEvent from './session/appendThinkingEvent';
import appendAssistantEvent from './session/appendAssistantEvent';
import appendToolCallEvent from './session/appendToolCallEvent';
import appendErrorEvent from './session/appendErrorEvent';
import getMessages from './session/getMessages';
import getEvents from './session/getEvents';
import getMaxEventIdx from './session/getMaxEventIdx';
import getFullMessages from './session/getFullMessages';
import syncAgentState from './session/syncAgentState';
import replaceMessages from './session/replaceMessages';
import truncateMessagesFrom from './session/truncateMessagesFrom';
import deleteMessageAt from './session/deleteMessageAt';
import updateScratchpad from './session/updateScratchpad';

import start from './agent/start';
import nextId from './agent/nextId';
import enqueue from './agent/enqueue';
import workerLoop from './agent/workerLoop';
import wakeWorker from './agent/wakeWorker';
import wakeWaiters from './agent/wakeWaiters';
import waitForEvent from './agent/waitForEvent';
import renderEventHtml from './agent/renderEventHtml';
import renderStatusBar from './agent/renderStatusBar';
import compact from './agent/compact';
import stop from './agent/stop';
import clear from './agent/clear';
import streamLLM from './agent/llmCall';

import streamMock from './llm/streamMock';
import resolveEndpoint from './llm/resolveEndpoint';
import streamDispatch from './llm/stream';

const fastHighlight = async (_c: any, s: any) =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function mkTestCtx(opts: { db?: string | false; quiet?: boolean } = {}): Promise<any> {
    const ctx: any = {
        state: {},
        env: {},
        routes: {},
        fns: {
            db: { connect, migrate, exec: dbExec, select: dbSelect, insert: dbInsert },
            session: {
                save, load, list, fork, loadAll, search,
                archive: archiveSession, delete: deleteSession,
                appendMessage, appendEvent,
                appendUserMessage, appendAssistantMessage, appendToolMessage,
                appendThinkingEvent, appendAssistantEvent, appendToolCallEvent, appendErrorEvent,
                getMessages, getEvents, getMaxEventIdx, getFullMessages,
                syncAgentState, replaceMessages, truncateMessagesFrom, deleteMessageAt, updateScratchpad,
            },
            agent: {
                start, nextId,
                enqueue, workerLoop, wakeWorker, wakeWaiters, waitForEvent,
                renderEventHtml, renderStatusBar,
                compact, stop, clear,
                llmCall: streamLLM,
            },
            llm: {
                stream: streamDispatch,
                streamMock,
                resolveEndpoint,
            },
            markdown: {
                highlight: fastHighlight,
                render: async (_c: any, s: string) => s,
            },
            events: {
                emit: () => {},
                emitAgentsChanged: () => {},
                subscribe: () => () => {},
            },
            repl: {
                // Default eval: echoes 'ok' for any code, returns 4 for "2+2".
                // Override per-test for richer behaviours.
                eval: async (_c: any, code: string) => (code === '2+2' ? 4 : 'ok'),
            },
        },
    };
    if (opts.db !== false) {
        ctx.fns.db.connect(ctx, opts.db ?? ':memory:');
        await ctx.fns.db.migrate(ctx);
    }
    return ctx;
}
