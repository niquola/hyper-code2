import { describe, test, expect } from "bun:test";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkTestCtx } from "../_testCtx.entry";

async function mkRepo() {
    const dir = await mkdtemp(join(tmpdir(), "hyper-git-"));
    const ctx = await mkTestCtx();
    await ctx.fns.git.run({ args: ["init"], dir });
    await ctx.fns.git.run({ args: ["config", "user.email", "test@example.com"], dir });
    await ctx.fns.git.run({ args: ["config", "user.name", "Test User"], dir });
    return { dir, ctx };
}

describe("git helpers", () => {
    test("stage + commit in temp repo", async () => {
        const { dir, ctx } = await mkRepo();
        await writeFile(join(dir, "a.txt"), "hello\n");
        await ctx.fns.git.stage({ paths: ["a.txt"], dir });
        await ctx.fns.git.commit({ message: "add a", dir });
        const log = await ctx.fns.git.run({ args: ["log", "--oneline", "-1"], dir });
        expect(log.stdout).toContain("add a");
    });

    test("stageCommitPush can skip push", async () => {
        const { dir, ctx } = await mkRepo();
        await mkdir(join(dir, "nested"));
        await writeFile(join(dir, "nested", "b.txt"), "world\n");
        const res: any = await ctx.fns.git.stageCommitPush({
            dir,
            paths: ["nested/b.txt"],
            message: "add b",
            push: false,
        });
        expect(res.committed.ok).toBe(true);
        expect(res.pushed).toBeNull();
        const st = await ctx.fns.git.status({ dir });
        expect(st.clean).toBe(true);
    });
});
