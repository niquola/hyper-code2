import { describe, test, expect } from "bun:test";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import run from "./run";
import stage from "./stage";
import commit from "./commit";
import status from "./status";
import stageCommitPush from "./stageCommitPush";

async function mkRepo() {
    const dir = await mkdtemp(join(tmpdir(), "hyper-git-"));
    const ctx: any = { fns: { git: { run, stage, commit, status, stageCommitPush } } };
    await run(ctx, { args: ["init"], dir });
    await run(ctx, { args: ["config", "user.email", "test@example.com"], dir });
    await run(ctx, { args: ["config", "user.name", "Test User"], dir });
    return { dir, ctx };
}

describe("git helpers", () => {
    test("stage + commit in temp repo", async () => {
        const { dir, ctx } = await mkRepo();
        await writeFile(join(dir, "a.txt"), "hello\n");
        await stage(ctx, { paths: ["a.txt"], dir });
        await commit(ctx, { message: "add a", dir });
        const log = await run(ctx, { args: ["log", "--oneline", "-1"], dir });
        expect(log.stdout).toContain("add a");
    });

    test("stageCommitPush can skip push", async () => {
        const { dir, ctx } = await mkRepo();
        await mkdir(join(dir, "nested"));
        await writeFile(join(dir, "nested", "b.txt"), "world\n");
        const res: any = await stageCommitPush(ctx, {
            dir,
            paths: ["nested/b.txt"],
            message: "add b",
            push: false,
        });
        expect(res.committed.ok).toBe(true);
        expect(res.pushed).toBeNull();
        const st = await status(ctx, { dir });
        expect(st.clean).toBe(true);
    });
});
