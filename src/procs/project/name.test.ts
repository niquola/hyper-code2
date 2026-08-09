// The project's name is a url segment now, so where it comes from is a contract
// and not a convenience: declared first, the folder only when nothing declares.
import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testCtx } from "../../$test";
import { slug } from "./name";

const ctx = await testCtx();
const at = (workdir: string) => ctx.fns.procs.env.fork({ mode: "test", env: { ...ctx.env, WORKDIR: workdir } });

function project(files: Record<string, any>): string {
    const dir = mkdtempSync(join(tmpdir(), "named-"));
    mkdirSync(dir, { recursive: true });
    for (const [file, body] of Object.entries(files)) writeFileSync(join(dir, file), JSON.stringify(body));
    return dir;
}

test("package.json wins, then workspace.json, then the folder", () => {
    const declared = project({ "package.json": { name: "cardio-clinic" }, "workspace.json": { name: "ignored" } });
    expect(at(declared).fns.procs.project.name({})).toBe("cardio-clinic");

    const inWorkspaceJson = project({ "workspace.json": { name: "engagement" } });
    expect(at(inWorkspaceJson).fns.procs.project.name({})).toBe("engagement");

    // Nothing declared: the folder, which is what a project that has not been
    // named yet has. `mkdtemp` gives `named-XXXX`, so the answer starts there.
    const bare = project({});
    expect(at(bare).fns.procs.project.name({})).toStartWith("named-");
});

test("what comes out is always one url segment", () => {
    // A scope says who publishes it, not what it is called here.
    expect(slug("@clinic/cardio")).toBe("cardio");
    expect(slug("Cardio Clinic")).toBe("cardio-clinic");
    expect(slug("  ../weird__name!  ")).toBe("weird-name");
    expect(slug("!!!")).toBe("app");
});
