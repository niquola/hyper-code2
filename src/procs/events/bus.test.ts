import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../../_testCtx.entry";

describe("procs.events — addressing", () => {
    test("a topic is an address: only its subscribers hear it", async () => {
        const ctx: any = await mkTestCtx();
        const a: any[] = [];
        const b: any[] = [];
        ctx.fns.procs.events.subscribe({ handler: (e: any) => a.push(e), topics: ["agent:a"] });
        ctx.fns.procs.events.subscribe({ handler: (e: any) => b.push(e), topics: ["agent:b", "agents"] });

        ctx.fns.procs.events.emit({ topic: "agent:a", event: { type: "x" } });
        ctx.fns.procs.events.emit({ topic: "agents", event: { type: "y" } });

        expect(a.map(e => e.topic)).toEqual(["agent:a"]);
        expect(b.map(e => e.topic)).toEqual(["agents"]);
    });

    test("an event with no topic is global — a restart concerns every tab", async () => {
        const ctx: any = await mkTestCtx();
        const narrow: any[] = [];
        const wide: any[] = [];
        ctx.fns.procs.events.subscribe({ handler: (e: any) => narrow.push(e), topics: ["agent:a"] });
        ctx.fns.procs.events.subscribe({ handler: (e: any) => wide.push(e) });

        ctx.fns.procs.events.emit({ event: { type: "reload" } });
        ctx.fns.procs.events.emit({ topic: "agent:b", event: { type: "msg" } });

        expect(narrow.map(e => e.type)).toEqual(["reload"]);
        // A subscriber that named nothing still hears everything, as it always did.
        expect(wide.map(e => e.type)).toEqual(["reload", "msg"]);
    });

    test("refresh carries no payload — it names what changed, nothing more", async () => {
        const ctx: any = await mkTestCtx();
        const seen: any[] = [];
        ctx.fns.procs.events.subscribe({ handler: (e: any) => seen.push(e), topics: ["agent:a"] });

        ctx.fns.procs.events.refresh({ topic: "agent:a", reason: "event" });

        expect(seen).toEqual([{ type: "refresh", reason: "event", topic: "agent:a" }]);
        // Nothing about position or sequence: there is no number to disagree
        // with after a restart, which is what used to wedge tabs into a loop.
        expect(Object.keys(seen[0])).not.toContain("seq");
    });

    test("unsubscribing stops delivery", async () => {
        const ctx: any = await mkTestCtx();
        const seen: any[] = [];
        const off = ctx.fns.procs.events.subscribe({ handler: (e: any) => seen.push(e), topics: ["t"] });

        ctx.fns.procs.events.refresh({ topic: "t" });
        off();
        ctx.fns.procs.events.refresh({ topic: "t" });

        expect(seen).toHaveLength(1);
    });
});
