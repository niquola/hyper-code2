// Centralised test context. Avoids hand-rewriting mkCtx in every test.
// `.entry.ts` suffix is skipped by the project scanner (see project/classify.ts),
// so this file is NOT auto-registered as a ctx.fns.testCtx.<x> function.
// Usage:
//   import { mkTestCtx } from '../_testCtx.entry';
//   const ctx = await mkTestCtx();         // :memory: db, migrations applied
//   const agent = ctx.fns.agent.start(ctx, { model: 'mock:echo' });
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
import buildLlmRequest from './agent/buildLlmRequest';
import fullSystemPrompt from './agent/fullSystemPrompt';
import executeMarker from './agent/executeMarker';
import executeBash from './agent/executeBash';
import sanitizeHtmlBody from './agent/sanitizeHtmlBody';
import highlightResult from './agent/highlightResult';
import serializeMarkerCall from './agent/serializeMarkerCall';
import formatMarkerResult from './agent/formatMarkerResult';
import formatMarkerError from './agent/formatMarkerError';
import parseMarkers from './agent/parseMarkers';

import streamMock from './llm/streamMock';
import resolveEndpoint from './llm/resolveEndpoint';
import streamDispatch from './llm/stream';

// Declared settings — keep in sync with src/**/$setting_*.ts.
// Imported here so tests with mkTestCtx see the same defaults as production.
import settingDefaultModel from './llm/$setting_defaultModel';
import settingLmstudioBaseUrl from './llm/$setting_lmstudioBaseUrl';
import settingOpenaiApiKey from './llm/$setting_openaiApiKey';
import settingKimiApiKey from './llm/$setting_kimiApiKey';
import settingGroqApiKey from './llm/$setting_groqApiKey';
import settingAnthropicApiKey from './llm/$setting_anthropicApiKey';
import settingOpenrouterApiKey from './llm/$setting_openrouterApiKey';
import settingAgentDebounceMs from './agent/$setting_debounceMs';

import settingsGet from './settings/get';
import settingsSet from './settings/set';
import settingsRemove from './settings/remove';
import settingsList from './settings/list';
import settingsGetNumber from './settings/getNumber';
import settingsGetString from './settings/getString';
import settingsDeclared from './settings/declared';
import settingsAgentDebounceMs from './settings/agentDebounceMs';
import settingsRenderDeclaredForm from './settings/renderDeclaredForm';

const fastHighlight = async (_c: any, opts: any) =>
    String(opts?.code ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function mkTestCtx(opts: { db?: string | false; quiet?: boolean } = {}): Promise<any> {
    const settingsRegistry = new Map<string, any>([
        ['llm.defaultModel',      settingDefaultModel],
        ['llm.lmstudioBaseUrl',   settingLmstudioBaseUrl],
        ['llm.openaiApiKey',      settingOpenaiApiKey],
        ['llm.kimiApiKey',        settingKimiApiKey],
        ['llm.groqApiKey',        settingGroqApiKey],
        ['llm.anthropicApiKey',   settingAnthropicApiKey],
        ['llm.openrouterApiKey',  settingOpenrouterApiKey],
        ['agent.debounceMs',      settingAgentDebounceMs],
    ]);
    const ctx: any = {
        state: { settingsRegistry },
        env: {},
        routes: {},
        fns: {
            db: { connect, migrate, exec: dbExec, select: dbSelect, insert: dbInsert },
            session: {
                save, load, list, fork, loadAll, search,
                archive: archiveSession, delete: deleteSession,
                appendMessage, appendEvent,
                appendUserMessage, appendAssistantMessage,
                appendThinkingEvent, appendAssistantEvent, appendToolCallEvent, appendErrorEvent,
                getMessages, getEvents, getMaxEventIdx, getFullMessages,
                syncAgentState, replaceMessages, truncateMessagesFrom, deleteMessageAt, updateScratchpad,
            },
            agent: {
                start, nextId,
                workerLoop, wakeWorker, wakeWaiters, waitForEvent,
                renderEventHtml, renderStatusBar,
                compact, stop, clear,
                llmCall: streamLLM,
                // Marker turn-loop helpers.
                parseMarkers,
                executeMarker, executeBash,
                sanitizeHtmlBody,
                highlightResult, serializeMarkerCall,
                formatMarkerResult, formatMarkerError,
                // System-prompt → messages bootstrap.
                buildLlmRequest, fullSystemPrompt,
            },
            llm: {
                stream: streamDispatch,
                streamMock,
                resolveEndpoint,
            },
            markdown: {
                highlight: fastHighlight,
                render: async (_c: any, opts: { source: string }) => opts.source,
            },
            events: {
                emit: () => {},
                emitAgentsChanged: () => {},
                subscribe: () => () => {},
            },
            repl: {
                // Default eval: echoes 'ok' for any code, returns 4 for "2+2".
                // Override per-test for richer behaviours.
                eval: async (_c: any, opts: { code: string }) => (opts.code === '2+2' ? 4 : 'ok'),
            },
            settings: {
                get: settingsGet,
                set: settingsSet,
                remove: settingsRemove,
                list: settingsList,
                getNumber: settingsGetNumber,
                getString: settingsGetString,
                declared: settingsDeclared,
                renderDeclaredForm: settingsRenderDeclaredForm,
                agentDebounceMs: settingsAgentDebounceMs,
            },
        },
    };
    if (opts.db !== false) {
        ctx.fns.db.connect(ctx, { path: opts.db ?? ':memory:' });
        await ctx.fns.db.migrate(ctx);
    }
    return ctx;
}
