import { describe, expect, test } from "bun:test";
import route from "./$route_next_unread_GET";

describe("GET /nav/next/unread", () => {
    test("returns next unread with wrap and skips read agents", async () => {
        const ctx: any = { fns: { session: { list: async () => [
            { id: "a", unread: 2 }, { id: "b", unread: 0 }, { id: "c", unread: 1 },
        ] } } };
        const call = async (current: string) => (await route(ctx, null, { req: new Request(`http://x/nav/next/unread?current=${current}`), params: {} })).json() as Promise<any>;
        expect((await call("a")).id).toBe("c");
        expect((await call("c")).id).toBe("a");
        expect((await call("b")).id).toBe("a");
    });

    test("returns null when nothing is unread", async () => {
        const ctx: any = { fns: { session: { list: async () => [{ id: "a", unread: 0 }] } } };
        const response = await route(ctx, null, { req: new Request("http://x/nav/next/unread?current=a"), params: {} });
        expect((await response.json() as any).id).toBeNull();
    });
});
