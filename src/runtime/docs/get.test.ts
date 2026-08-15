import { test, expect } from "bun:test";
import { testCtx } from "../../$test";

const ctx = await testCtx();

test("runtime.docs.get exposes JSDoc, types and parameter schema", () => {
    const meta = ctx.fns.runtime.docs.get({ name: "agent.reflect" });
    expect(meta.summary).toContain("background reflection");
    expect(meta.returnType).toContain("started: boolean");
    expect(meta.paramsSchema.required).toContain("agent");
    expect(meta.paramsSchema.properties.agent.description).toContain("conversation");
    expect(meta.paramsSchema.properties.every).toMatchObject({ type: "number", default: 3, minimum: 1 });
});

test("runtime.docs search is compact and list filters namespaces", async () => {
    const hits = await ctx.fns.runtime.docs.search({ query: "reflection conversation", mode: "lexical" });
    expect(hits[0]?.name).toBe("agent.reflect");
    expect((hits[0] as any).paramsSchema).toBeUndefined();
    const listed = ctx.fns.runtime.docs.list({ namespace: "runtime.docs" });
    expect(listed.map((x: any) => x.name)).toEqual(["runtime.docs.get", "runtime.docs.index", "runtime.docs.list", "runtime.docs.search"]);
});
