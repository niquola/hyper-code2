import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("session.load", () => {
    test("returns null when id unknown", async () => {
        const ctx: any = await mkTestCtx();
        expect(ctx.fns.session.load({ id: "nope" })).toBeNull();
    });

    test("round-trip: save → load reconstructs agent shape", async () => {
        const ctx: any = await mkTestCtx();
        const original = ctx.fns.agent.start({ model: "m", systemPrompt: "sp" });
        original.scratchpad.note = 'remember';
        ctx.fns.session.save({ agent: original });
        ctx.fns.session.replaceMessages({ id: original.id, messages: [
            { role: 'user', content: 'a' },
            { role: 'assistant', content: '§eval\nconsole.log(1);' },
            { role: 'user', content: '§result:eval\n1' },
        ] });
        ctx.fns.session.replaceEvents({ id: original.id, events: [
            { type: 'user', text: 'a' },
            { type: 'tool_call', name: 'eval', args: { code: 'console.log(1);' }, result: '1' },
        ] });

        // fresh ctx, same db — simulate restart
        const ctx2: any = await mkTestCtx();
        (ctx2.state as any).procs.db.connection = ctx.fns.procs.db.conn();
        const loaded = ctx2.fns.session.load({ id: original.id });
        expect(loaded).not.toBeNull();
        expect(loaded!.id).toBe(original.id);
        expect(loaded!.model).toBe("m");
        expect(loaded!.systemPrompt).toBe("sp");
        expect(loaded!.messages).toEqual([
            { role: 'user', content: 'a' },
            { role: 'assistant', content: '§eval\nconsole.log(1);' },
            { role: 'user', content: '§result:eval\n1' },
        ]);
        expect(loaded!.events).toEqual([
            { type: 'user', text: 'a' },
            { type: 'tool_call', name: 'eval', args: { code: 'console.log(1);' }, result: '1' },
        ]);
        expect(loaded!.scratchpad).toEqual({ note: "remember" });
        expect(loaded!.isStreaming).toBe(false);
    });
});
