import { describe, expect, test } from "bun:test";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import resolveSafe from "../files/resolveSafe";
import executeBash from "../agent/executeBash";
import gitRun from "../git/run";

describe("agent workspace", () => {
    test("files and bash use session.workspaceDir without changing process cwd", async () => {
        const dir = await mkdtemp(join(tmpdir(), "hyper-workspace-"));
        const originalCwd = process.cwd();
        try {
            await writeFile(join(dir, "marker.txt"), "workspace");
            const session: any = { agentId: "aa", workspaceDir: dir };

            expect(resolveSafe({} as any, session, { path: "marker.txt" })).toBe(join(dir, "marker.txt"));
            const result = await executeBash({} as any, session, { code: "pwd; cat marker.txt" });
            expect(result.isError).toBe(false);
            expect(result.output).toBe(`${await realpath(dir)}\nworkspace`);
            expect(process.cwd()).toBe(originalCwd);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    test("git defaults to session.workspaceDir", async () => {
        const dir = await mkdtemp(join(tmpdir(), "hyper-workspace-git-"));
        try {
            await Bun.$`git init -q ${dir}`;
            const result = await gitRun({} as any, { workspaceDir: dir } as any, {
                args: ["rev-parse", "--show-toplevel"],
            });
            expect(result.stdout.trim()).toBe(await realpath(dir));
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});