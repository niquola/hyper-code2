import { expect, test } from "bun:test";
import { testCtx } from "../$test";

const ctx = await testCtx({ env: { PROCS_PLUGINS: "./plugins" } });

test("reads SKILL.md for a mounted plugin by container or namespace", async () => {
    const byName = await ctx.fns.plugins.readSkill({ name: "browser" });
    const byNamespace = await ctx.fns.plugins.readSkill({ name: "cdp", maxChars: 80 });

    expect(byName.path.endsWith("/plugins/browser/SKILL.md")).toBe(true);
    expect(byName.text).toContain("# browser");
    expect(byName.truncated).toBe(false);
    expect(byNamespace.name).toBe("browser");
    expect(byNamespace.text.length).toBe(80);
    expect(byNamespace.truncated).toBe(true);
});

test("rejects unknown or undocumented plugins", async () => {
    await expect(ctx.fns.plugins.readSkill({ name: "missing" })).rejects.toThrow(/not found/);
});
