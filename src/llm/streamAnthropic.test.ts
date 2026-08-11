import { test, expect, describe, afterEach } from "bun:test";
import stream from "./streamAnthropic";
import parseSSE from "./parseSSE";
import toAnthropicMessages from "./toAnthropicMessages";

// Offline: drive streamAnthropic through the shared parseSSE with a mocked fetch.
// Uses provider 'anthropic' so no OAuth refresh path is touched.
function sseResponse(...chunks: string[]): Response {
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
        start(c) { for (const s of chunks) c.enqueue(enc.encode(s)); c.close(); },
    });
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}
// Plain-object ctx (not the injecting Proxy) — fns entries are invoked with
// opts only, so shared real fns are wrapped as (opts) => raw(ctx, null, opts).
function mkCtx(): Context {
    const ctx: any = { state: {}, env: {} };
    ctx.fns = {
        agent: {
            buildLlmRequest: async () => ({ system: "sys", messages: [{ role: "user", content: "hi" }] }),
            wireTools: () => [],
        },
        llm: {
            resolveEndpoint: () => ({ url: "http://mock/v1/messages", modelId: "claude-x", apiKey: "k", provider: "anthropic", api: "anthropic" }),
            parseSSE: (opts: any) => parseSSE(ctx, null, opts),
            connectFetch: (o: any) => fetch(o.url, o.init),
            toAnthropicMessages: (opts: any) => toAnthropicMessages(ctx, null, opts),
        },
    };
    return ctx as unknown as Context;
}
const agent = () => ({ id: "a1", model: "anthropic:claude-x", systemPrompt: "", messages: [], scratchpad: {} } as any);

describe("streamAnthropic — offline (mocked fetch + shared parseSSE)", () => {
    const realFetch = globalThis.fetch;
    afterEach(() => { globalThis.fetch = realFetch; });

    test("accumulates text deltas, maps stop_reason, reads usage", async () => {
        globalThis.fetch = (async () => sseResponse(
            'event: message_start\ndata: {"message":{"usage":{"input_tokens":10}}}\n\n',
            'event: content_block_delta\ndata: {"delta":{"type":"text_delta","text":"Hel"}}\n\n',
            'event: content_block_delta\ndata: {"delta":{"type":"text_delta","text":"lo"}}\n\n',
            'event: message_delta\ndata: {"delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}\n\n',
        )) as any;
        const deltas: string[] = [];
        const res = await stream(mkCtx(), null, { agent: agent(), onEvent: (ev) => { if (ev.type === "text_delta") deltas.push(ev.delta); } });
        expect(res.text).toBe("Hello");
        expect(res.finishReason).toBe("stop"); // end_turn → stop
        expect(res.usage.prompt_tokens).toBe(10);
        expect(res.usage.completion_tokens).toBe(5);
        expect(deltas.join("")).toBe("Hello");
    });

    test("handles Kimi-style SSE (no space after colon) + thinking deltas", async () => {
        globalThis.fetch = (async () => sseResponse(
            'event:content_block_delta\ndata:{"delta":{"type":"thinking_delta","thinking":"hmm"}}\n\n',
            'event:content_block_delta\ndata:{"delta":{"type":"text_delta","text":"yo"}}\n\n',
        )) as any;
        const res = await stream(mkCtx(), null, { agent: agent() });
        expect(res.text).toBe("yo");
        expect(res.thinking).toBe("hmm");
    });
});
