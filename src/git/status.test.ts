import { describe, expect, test } from "bun:test";
import status from "./status";

// Hand-built ctx: fns.git.run is opts-only (the shape the injecting Proxy
// exposes to call sites inside status.ts).
const mkCtx = (run: (opts: { args: string[] }) => Promise<any>) =>
  ({ fns: { git: { run } } }) as any as Context;

describe("git.status", () => {
  test("groups porcelain output by full status names", async () => {
    const ctx = mkCtx(async () => ({
      ok: true,
      code: 0,
      stdout: " M src/a.ts\0M  src/b.ts\0?? src/c.ts\0D  src/d.ts\0R  old.ts -> new.ts\0",
      stderr: "",
    }));

    const r: any = await status(ctx, null, {});
    expect(r).toEqual({
      clean: false,
      modified: ["src/a.ts"],
      staged: ["src/b.ts", "src/d.ts", "new.ts"],
      untracked: ["src/c.ts"],
      deleted: ["src/d.ts"],
      renamed: [{ from: "old.ts", to: "new.ts" }],
    });
  });

  test("omits empty keys in normal mode", async () => {
    const ctx = mkCtx(async () => ({ ok: true, code: 0, stdout: "?? src/c.ts\0", stderr: "" }));
    const r: any = await status(ctx, null, {});
    expect(r).toEqual({ clean: false, untracked: ["src/c.ts"] });
  });

  test("summary mode returns only total and non-zero counts", async () => {
    const ctx = mkCtx(async () => ({
      ok: true,
      code: 0,
      stdout: " M src/a.ts\0M  src/b.ts\0?? src/c.ts\0D  src/d.ts\0R  old.ts -> new.ts\0",
      stderr: "",
    }));
    const r: any = await status(ctx, null, { summary: true });
    expect(r).toEqual({
      clean: false,
      total: 5,
      modified: 1,
      staged: 3,
      untracked: 1,
      deleted: 1,
      renamed: 1,
    });
  });

  test("summary mode for clean repo stays tiny", async () => {
    const ctx = mkCtx(async () => ({ ok: true, code: 0, stdout: "", stderr: "" }));
    const r: any = await status(ctx, null, { summary: true });
    expect(r).toEqual({ clean: true });
  });

  test("staged mode returns only staged-focused data", async () => {
    const ctx = mkCtx(async () => ({
      ok: true,
      code: 0,
      stdout: " M src/a.ts\0M  src/b.ts\0D  src/d.ts\0R  old.ts -> new.ts\0",
      stderr: "",
    }));
    const r: any = await status(ctx, null, { staged: true });
    expect(r).toEqual({
      clean: false,
      staged: ["src/b.ts", "src/d.ts", "new.ts"],
      deleted: ["src/d.ts"],
      renamed: [{ from: "old.ts", to: "new.ts" }],
    });
  });

  test("uses no-untracked flag for staged mode", async () => {
    let args: string[] = [];
    const ctx = mkCtx(async (opts: { args: string[] }) => {
      args = opts.args;
      return { ok: true, code: 0, stdout: "", stderr: "" };
    });
    await status(ctx, null, { staged: true });
    expect(args).toEqual(["status", "--porcelain=v1", "-z", "--untracked-files=no"]);
  });
});
