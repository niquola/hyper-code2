import { afterEach, describe, expect, test } from "bun:test";
import stream from "./streamXai";
import parseSSE from "./parseSSE";
import toCodexInput from "./toCodexInput";

function sseResponse(...chunks: string[]): Response {
    const enc = new TextEncoder();
    return new Response(new ReadableStream<Uint8Array>({
        start(c) { for (const chunk of chunks) c.enqueue(enc.encode(chunk)); c.close(); },
    }), { status: 200, headers: { "content-type": "text/event-stream" } });
}

function mkCtx(tools: any[] = [], onUsage?: (opts: any) => void): Context {
    const ctx: any = { state: {}, env: {} };
    ctx.fns = {
        agent: {
            buildLlmRequest: async () => ({ system: "sys", messages: [{ role: "user", content: "hi" }] }),
            wireTools: () => tools,
        },
        llm: {
            resolveEndpoint: () => ({ url: "https://api.x.ai/v1/responses", modelId: "grok-4.6", apiKey: null, provider: "xai", account: "default", kind: "subscription", api: "responses" }),
            getXaiOAuthToken: async () => "xai-oauth-token",
            resolveReasoningEffort: async () => ({ requested: "high", applied: "high", mode: "openai-effort", downgraded: false, reason: null }),
            toCodexInput: (opts: any) => toCodexInput(ctx, null, opts),
            accountAuthHealth: async () => [],
            classifyError: (opts: any) => ({ kind: "fatal", retryable: false, message: `xai ${opts.status}` }),
            parseSSE: (opts: any) => parseSSE(ctx, null, opts),
            connectFetch: (opts: any) => fetch(opts.url, opts.init),
            recordUsage: async () => null,
            refreshUsage: async (opts: any) => { onUsage?.(opts); return []; },
        },
    };
    return ctx as Context;
}

const agent = () => ({ id: "a1", model: "xai:grok-4.6", reasoningEffort: "high", systemPrompt: "", messages: [], scratchpad: {} } as any);
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

describe("streamXai", () => {
    test("sends xAI Responses fields and parses text, reasoning, tools and usage", async () => {
        let request: any; let headers: Headers; let recorded: any;
        globalThis.fetch = (async (_url: any, init: any) => {
            request = JSON.parse(init.body); headers = new Headers(init.headers);
            return new Response((await sseResponse(
                'data: {"type":"response.reasoning_summary_text.delta","delta":"think"}\n\n',
                'data: {"type":"response.output_text.delta","delta":"hello"}\n\n',
                'data: {"type":"response.output_item.done","item":{"type":"function_call","call_id":"c1","name":"read","arguments":"{\\"path\\":\\"a\\"}"}}\n\n',
                'data: {"type":"response.completed","response":{"usage":{"input_tokens":8,"output_tokens":5}}}\n\n',
            ).blob()), { status: 200, headers: { "content-type": "text/event-stream", "x-ratelimit-limit-tokens": "1000", "x-ratelimit-remaining-tokens": "750" } });
        }) as any;
        const tool = { type: "function", name: "read", parameters: { type: "object" }, strict: true };
        const result = await stream(mkCtx([tool], (opts) => { recorded = opts; }), null, { agent: agent() });
        expect(headers!.get("authorization")).toBe("Bearer xai-oauth-token");
        expect(headers!.get("session_id")).toBe("a1");
        expect(request).toMatchObject({ model: "grok-4.6", store: false, stream: true, prompt_cache_key: "a1", reasoning: { effort: "high" }, include: ["reasoning.encrypted_content"], parallel_tool_calls: true });
        expect(request.tools).toEqual([tool]);
        expect(result).toMatchObject({ text: "hello", thinking: "think", finishReason: "stop", usage: { prompt_tokens: 8, completion_tokens: 5 }, toolCalls: [{ id: "c1", name: "read", args: { path: "a" } }] });
        expect(recorded.provider).toBe("xai");
        expect(recorded.account).toBe("default");
        expect(recorded.maxAgeMs).toBe(60_000);
    });

    test("marks 401 credentials unhealthy and classifies the subscription failure", async () => {
        const ctx: any = mkCtx(); let marked = false;
        ctx.fns.llm.accountAuthHealth = async (opts: any) => { if (opts.action === "mark") marked = true; return []; };
        globalThis.fetch = (async () => new Response('{"error":"expired"}', { status: 401 })) as any;
        await expect(stream(ctx, null, { agent: agent() })).rejects.toThrow("xai 401");
        expect(marked).toBe(true);
    });
});
