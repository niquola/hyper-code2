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
});
