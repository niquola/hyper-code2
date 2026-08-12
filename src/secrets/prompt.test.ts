import { describe, expect, test } from "bun:test";
import prompt from "./prompt";

describe("secrets.prompt", () => {
    test("emits only metadata and resolves through the private in-memory capability", async () => {
        const events: any[] = [];
        const ctx: any = { state: {}, fns: { procs: { events: { emit: ({ event }: any) => events.push(event) } } } };
        const waiting = prompt(ctx, null, { title: "Code", kind: "otp", timeoutMs: 10_000 });
        const opened = events[0];
        expect(opened).toMatchObject({ type: "secret.prompt", title: "Code", kind: "otp" });
        expect(JSON.stringify(opened)).not.toContain("123456");
        ctx.state.secrets.prompts.get(opened.id).resolve("123456");
        expect(await waiting).toBe("123456");
        expect(ctx.state.secrets.prompts.has(opened.id)).toBe(false);
    });
});
