import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";
import toAnthropic from "../llm/toAnthropicMessages";
import toCodex from "../llm/toCodexInput";

describe("chat attachments", () => {
    test("multipart image persists a compact ref and metadata", async () => {
        const ctx = await mkTestCtx();
        ctx.state.registry.agent.wakeWorker = () => {};
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        await ctx.fns.session.save({ agent });
        (ctx.state as any).agent = { [agent.id]: agent };
        const png = new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,1,2,3]);
        const form = new FormData();
        form.set("text", "look");
        form.append("files", new File([png], "screen.png", { type: "image/png" }));
        const response = await ctx.fns.procs.http.dispatch({ method: "POST", url: `/agent/${agent.id}?debounceSeconds=0`, body: form });
        expect(response.status).toBe(200);
        const messages = await ctx.fns.session.getMessages({ id: agent.id });
        expect(messages[0].content[1]).toMatchObject({ type: "image_ref", fileName: "screen.png", mimeType: "image/png" });
        const rows = await ctx.fns.procs.db.select({ sql: "SELECT * FROM attachments WHERE agent_id=?", params: [agent.id] }) as any[];
        expect(rows).toHaveLength(1);
        expect(String(rows[0].storage_path)).not.toContain("screen.png");
    });

    test("Anthropic emits native PDF document; Codex uses extracted text", () => {
        const message = { role: "user", content: [{ type: "document", data: "JVBERg==", mimeType: "application/pdf", fileName: "a.pdf", extractedText: "hello", path: "/tmp/a.pdf" }] };
        const anthropic = toAnthropic({} as any, null, { messages: [message] });
        expect(anthropic[0].content[0]).toMatchObject({ type: "document", source: { type: "base64", media_type: "application/pdf" } });
        const codex = toCodex({} as any, null, { messages: [message] });
        expect(codex.input[0].content[0].text).toContain("hello");
        expect(codex.input[0].content[0].text).toContain("/tmp/a.pdf");
    });
});
