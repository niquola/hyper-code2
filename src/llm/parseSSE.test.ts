import { describe, test, expect } from "bun:test";
import parseSSE from "./parseSSE";

const ctx = {} as Context;

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
    const enc = new TextEncoder();
    return new ReadableStream<Uint8Array>({
        start(c) {
            for (const s of chunks) c.enqueue(enc.encode(s));
            c.close();
        },
    });
}

async function collect(body: ReadableStream<Uint8Array>) {
    const out: { event: string | null; data: string }[] = [];
    for await (const f of parseSSE(ctx, null, { body })) out.push(f);
    return out;
}

describe("llm.parseSSE", () => {
    test("OpenAI-style: data-only frames + [DONE], one leading space stripped", async () => {
        expect(await collect(streamOf('data: {"a":1}\n\ndata: [DONE]\n\n'))).toEqual([
            { event: null, data: '{"a":1}' },
            { event: null, data: "[DONE]" },
        ]);
    });

    test("Anthropic-style: event + data per frame", async () => {
        expect(await collect(streamOf('event: message_start\ndata: {"x":1}\n\nevent: ping\ndata: {}\n\n'))).toEqual([
            { event: "message_start", data: '{"x":1}' },
            { event: "ping", data: "{}" },
        ]);
    });

    test("Kimi-style: no space after colon", async () => {
        expect(await collect(streamOf('event:foo\ndata:{"y":2}\n\n'))).toEqual([
            { event: "foo", data: '{"y":2}' },
        ]);
    });

    test("multi-line data (Codex) is joined by newline", async () => {
        expect(await collect(streamOf("data: line1\ndata: line2\n\n"))).toEqual([
            { event: null, data: "line1\nline2" },
        ]);
    });

    test("a frame split across chunks is reassembled", async () => {
        expect(await collect(streamOf('data: {"a":', '1}\n', "\n"))).toEqual([
            { event: null, data: '{"a":1}' },
        ]);
    });

    test("comment/keepalive frames (no data:) are skipped", async () => {
        expect(await collect(streamOf(": keepalive\n\ndata: {}\n\n"))).toEqual([
            { event: null, data: "{}" },
        ]);
    });

    test("trailing frame without terminating blank line is NOT yielded (matches buffered behaviour)", async () => {
        expect(await collect(streamOf('data: {"a":1}\n\ndata: {"b":2}'))).toEqual([
            { event: null, data: '{"a":1}' },
        ]);
    });
});
