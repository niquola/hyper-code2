import { expect, test } from "bun:test";
import { testCtx } from "../../$test";

const ctx = await testCtx();

test("createFunction requires complete authoring metadata", async () => {
    await expect(ctx.fns.procs.dev.createFunction({ module: "demo", name: "ping", summary: "Short", description: "Too short", params: [], returnType: "Promise<string>", body: "return 'pong';", dryRun: true })).rejects.toThrow("summary");
});

test("createFunction dry run renders documented typed source without writing", async () => {
    const result = await ctx.fns.procs.dev.createFunction({
        module: "demo", name: "lookup", summary: "Looks up one documented record",
        description: "Use this function to retrieve one record by its stable identifier.",
        params: [{ name: "id", type: "string", required: true, description: "Stable record identifier." }],
        returnType: "Promise<string>", body: "return opts.id;", dryRun: true,
    });
    expect(result.written).toBe(false);
    expect(result.source).toContain("@param opts.id Stable record identifier.");
    expect(result.source).toContain("id: string;");
    expect(await Bun.file(`${ctx.state.root}/src/demo/lookup.ts`).exists()).toBe(false);
});

test("createFunction refuses an existing function without overwrite", async () => {
    await expect(ctx.fns.procs.dev.createFunction({
        module: "agent", name: "reflect", summary: "Reflects over an agent conversation",
        description: "Use this function to reflect over recent messages for an existing agent.",
        params: [], returnType: "Promise<void>", body: "return;",
    })).rejects.toThrow("already exists");
});
