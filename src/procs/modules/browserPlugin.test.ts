import { expect, test } from "bun:test";
import { testCtx } from "../../$test";

const ctx = await testCtx({ env: { PROCS_PLUGINS: "./plugins" } });

test("mounts the project browser plugin and exposes its namespaces", () => {
    const browser = ctx.fns.procs.modules.list({}).find((module: any) => module.name === "browser");

    // Narrow instead of asserting-then-dereferencing: `find` returns undefined
    // and TypeScript is right to say so, and a missing module should fail as
    // "not mounted" rather than as a null dereference three lines later.
    if (!browser) throw new Error("browser plugin is not mounted");
    expect(browser.plugin).toBe(true);
    expect(browser.namespaces).toContain("browser");
    expect(browser.namespaces).toContain("cdp");

    // Mounted means callable: the namespaces have to be in ctx.fns, not merely
    // listed in the modules table.
    expect(typeof ctx.fns.browser.tabs).toBe("function");
    expect(typeof ctx.fns.browser.title).toBe("function");
    expect(typeof ctx.fns.cdp.send).toBe("function");
});
