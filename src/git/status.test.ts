import { describe, expect, test } from "bun:test";
import status from "./status";

describe("git.status", () => {
  test("groups porcelain output by full status names", async () => {
    const ctx = {
      fns: {
        git: {
          run: async () => ({
            ok: true,
            code: 0,
            stdout: " M src/a.ts\0M  src/b.ts\0?? src/c.ts\0D  src/d.ts\0R  old.ts -> new.ts\0",
            stderr: "",
          }),
        },
      },
    } as any as Context;

    const r: any = await status(ctx, {});
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
    const ctx = { fns: { git: { run: async () => ({ ok: true, code: 0, stdout: "?? src/c.ts\0", stderr: "" }) } } } as any as Context;
    const r: any = await status(ctx, {});
    expect(r).toEqual({ clean: false, untracked: ["src/c.ts"] });
  });

  test("summary mode returns only total and non-zero counts", async () => {
    const ctx = {
      fns: {
        git: {
          run: async () => ({
            ok: true,
            code: 0,
            stdout: " M src/a.ts\0M  src/b.ts\0?? src/c.ts\0D  src/d.ts\0R  old.ts -> new.ts\0",
            stderr: "",
          }),
        },
      },
    } as any as Context;
    const r: any = await status(ctx, { summary: true });
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
    const ctx = { fns: { git: { run: async () => ({ ok: true, code: 0, stdout: "", stderr: "" }) } } } as any as Context;
    const r: any = await status(ctx, { summary: true });
    expect(r).toEqual({ clean: true });
  });

  test("staged mode returns only staged-focused data", async () => {
    const ctx = {
      fns: {
        git: {
          run: async () => ({
            ok: true,
            code: 0,
            stdout: " M src/a.ts\0M  src/b.ts\0D  src/d.ts\0R  old.ts -> new.ts\0",
            stderr: "",
          }),
        },
      },
    } as any as Context;
    const r: any = await status(ctx, { staged: true });
    expect(r).toEqual({
      clean: false,
      staged: ["src/b.ts", "src/d.ts", "new.ts"],
      deleted: ["src/d.ts"],
      renamed: [{ from: "old.ts", to: "new.ts" }],
    });
  });

  test("uses no-untracked flag for staged mode", async () => {
    let args: string[] = [];
    const ctx = {
      fns: {
        git: {
          run: async (_ctx: Context, opts: { args: string[] }) => {
            args = opts.args;
            return { ok: true, code: 0, stdout: "", stderr: "" };
          },
        },
      },
    } as any as Context;
    await status(ctx, { staged: true });
    expect(args).toEqual(["status", "--porcelain=v1", "-z", "--untracked-files=no"]);
  });
});
