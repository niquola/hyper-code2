import { describe, expect, test } from "bun:test";
import prompt from "./prompt";

describe("secureInput.prompt", () => {
    test("emits only metadata and resolves through the private in-memory capability", async () => {
        const events: any[] = [];
        const ctx: any = { state: {}, fns: { procs: { events: { emit: ({ event }: any) => events.push(event) } } } };
        const waiting = prompt(ctx, null, { title: "Code", kind: "otp", timeoutMs: 10_000 });
        const opened = events[0];
        expect(opened).toMatchObject({ type: "secure-input.prompt", title: "Code", kind: "otp" });
        expect(JSON.stringify(opened)).not.toContain("123456");
        ctx.state.secureInput.prompts.get(opened.id).resolve("123456");
        expect(await waiting).toBe("123456");
        expect(ctx.state.secureInput.prompts.has(opened.id)).toBe(false);
    });

    test("a new prompt is rejected while the active prompt is preserved", async () => {
        const events: any[] = [];
        const ctx: any = { state: {}, fns: { procs: { events: { emit: ({ event }: any) => events.push(event) } } } };
        const first = prompt(ctx, null, { title: "First", kind: "text", timeoutMs: 10_000 });
        const firstId = events.find((e: any) => e.type === "secure-input.prompt").id;
        await expect(prompt(ctx, null, { title: "Second", kind: "text", timeoutMs: 10_000 })).rejects.toThrow("already active");
        expect(ctx.state.secureInput.prompts.has(firstId)).toBe(true);
        expect(ctx.state.secureInput.prompts.size).toBe(1);
        ctx.state.secureInput.prompts.get(firstId).resolve("ok");
        expect(await first).toBe("ok");
    });

});
