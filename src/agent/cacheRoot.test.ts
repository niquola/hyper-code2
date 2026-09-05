import { describe, expect, test } from "bun:test";
import cacheRoot from "./cacheRoot";

function ctx(agents: Record<string, any>): any {
    return { state: { agent: agents }, fns: { session: { load: async ({ id }: any) => agents[id] ?? null } } };
}

describe("agent.cacheRoot", () => {
    test("a fork with null offset inherits everything and resolves to the parent", async () => {
        const root = { id: "aa", parentId: null, forkOffset: null };
        const child = { id: "bb", parentId: "aa", forkOffset: null };
        expect(await cacheRoot(ctx({ aa: root, bb: child }), null, { agent: child as any })).toBe("aa");
    });

    test("a plain agent is its own cache root", async () => {
        expect(await cacheRoot(ctx({}), null, { agent: { id: "aa" } as any })).toBe("aa");
    });

    test("a transcript-sharing fork resolves to the topmost ancestor", async () => {
        const root = { id: "aa", parentId: null, forkOffset: null };
        const mid = { id: "bb", parentId: "aa", forkOffset: 10 };
        const leaf = { id: "cc", parentId: "bb", forkOffset: 12 };
        expect(await cacheRoot(ctx({ aa: root, bb: mid, cc: leaf }), null, { agent: leaf as any })).toBe("aa");
    });

    test("a delegated child with offset 0 shares no prefix and keeps its own id", async () => {
        const root = { id: "aa", parentId: null, forkOffset: null };
        const child = { id: "bb", parentId: "aa", forkOffset: 0 };
        expect(await cacheRoot(ctx({ aa: root, bb: child }), null, { agent: child as any })).toBe("bb");
    });
});
