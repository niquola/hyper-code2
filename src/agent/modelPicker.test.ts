import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("agent.modelPicker", () => {
    test("groups model routes by provider and marks the current model", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        ctx.fns.llm.listModels = async () => ({
            mock: ["mock:test", "mock:other"],
            openai: ["openai:gpt-test"],
        });

        const response = await ctx.fns.agent.modelPicker({ agentId: agent.id });
        expect(response.status).toBe(200);
        const html = await response.text();
        expect(html).toContain("Provider and model");
        expect(html).toContain("mock:test");
        expect(html).toContain("mock:other");
        expect(html).toContain("OpenAI API");
        expect(html).toContain('aria-current="true"');
        expect(html).toContain(`/agent/${agent.id}/model`);
        expect(html).toContain("data-model-provider-tab");
        expect(html).toContain('aria-selected="true"');
        expect(html).toContain("data-model-provider-panel");
        expect(html).toContain('class="hidden min-h-0"');

    });

    test("keeps the current route visible when it is absent from the catalogue", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:private" });
        ctx.fns.llm.listModels = async () => ({});

        const response = await ctx.fns.agent.modelPicker({ agentId: agent.id });
        expect(await response.text()).toContain("mock:private");
    });

    test("returns 404 for an unknown agent", async () => {
        const ctx: any = await mkTestCtx();
        const response = await ctx.fns.agent.modelPicker({ agentId: "missing" });
        expect(response.status).toBe(404);
    });

    test("switches through the HTTP route and asks HTMX to refresh the chat", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        const response = await ctx.fns.procs.http.dispatch({
            url: `/agent/${agent.id}/model`,
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded", "hx-request": "true" },
            body: new URLSearchParams({ model: "mock:other" }).toString(),
        });

        expect(response.status).toBe(204);
        expect(response.headers.get("HX-Refresh")).toBe("true");
        expect((await ctx.fns.session.load({ id: agent.id })).model).toBe("mock:other");
    });

});
