import { describe, expect, test } from "bun:test";
import handleRequest from "./handleRequest";
import layout from "../$layout";

function mkCtx() {
    return {
        env: {},
        state: {
            agent: {
                aa: { id: "aa", isStreaming: false },
            },
        },
        routes: {
            "/ok": {
                GET: async () => ({
                    title: "ok",
                    main: `<div>ok</div>`,
                }),
            },
            "/404": {
                GET: async () => ({
                    title: "404",
                    main: `<div class="flex-1 flex items-center justify-center"><div class="text-center"><div>404</div></div></div>`,
                    status: 404,
                }),
            },
        },
        fns: {
            http: {
                match: (routes: any, method: string, pathname: string) => {
                    const bucket = routes[pathname];
                    if (!bucket || !bucket[method]) return null;
                    return { handler: bucket[method], params: {} };
                },
            },
            session: {
                list: () => [{
                    id: "aa",
                    model: "mock:model",
                    title: "test agent",
                    turns: 1,
                    createdAt: 1,
                    updatedAt: 1,
                }],
            },
            files: {
                listOpen: () => [],
            },
        },
        layout,
    } as unknown as Context;
}

describe("http.handleRequest", () => {
    test("dispatches matched route and wraps layout HTML", async () => {
        const ctx = mkCtx();
        const res = await handleRequest(ctx, { req: new Request("http://localhost/ok") });
        const html = await res.text();

        expect(res.status).toBe(200);
        expect(html).toContain("<aside");
        expect(html).toContain("<div>ok</div>");
    });

    test("renders layout-wrapped 404 page for unknown routes", async () => {
        const ctx = mkCtx();
        const res = await handleRequest(ctx, { req: new Request("http://localhost/nope") });
        const html = await res.text();

        expect(res.status).toBe(404);
        expect(html).toContain("<aside");
        expect(html).toContain("404");
    });
});