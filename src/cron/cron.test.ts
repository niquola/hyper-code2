import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

let ctx: any;
const names: string[] = [];

beforeAll(async () => {
    ctx = await mkTestCtx();
    await ctx.fns.procs.migrate.up({});
    ctx.fns.testCron = {
        echo: async (_ctx: any, _session: any, opts: any) => ({ value: opts.value }),
    };
});

afterAll(async () => {
    for (const name of names) await ctx.fns.procs.db.run({ sql: "DELETE FROM cron_jobs WHERE name = ?", params: [name] });
    await ctx.fns.procs.db.close?.({});
});

describe("cron", () => {
    test("add replaces a pending recurring occurrence", async () => {
        const name = `test-add-${crypto.randomUUID()}`; names.push(name);
        await ctx.fns.cron.add({ name, fn: "testCron.echo", every: "1h", args: { value: 1 } });
        await ctx.fns.cron.add({ name, fn: "testCron.echo", every: "2h", args: { value: 2 } });
        const rows = await ctx.fns.procs.db.select({ sql: "SELECT every_ms, args FROM cron_jobs WHERE name = ? AND status = 'pending'", params: [name] });
        expect(rows).toHaveLength(1);
        expect(Number(rows[0].every_ms)).toBe(7_200_000);
        expect(rows[0].args.value).toBe(2);
    });

    test("concurrent claims return a due occurrence once", async () => {
        const name = `test-claim-${crypto.randomUUID()}`; names.push(name);
        await ctx.fns.cron.defer({ name, fn: "testCron.echo", in: -1, args: { value: 3 } });
        const [a, b] = await Promise.all([ctx.fns.cron.claim({}), ctx.fns.cron.claim({})]);
        expect([a, b].filter(Boolean)).toHaveLength(1);
    });

    test("runOne records result and reschedules recurring work", async () => {
        const name = `test-run-${crypto.randomUUID()}`; names.push(name);
        await ctx.fns.cron.add({ name, fn: "testCron.echo", every: "1s", now: true, args: { value: 42 } });
        const job = await ctx.fns.cron.claim({});
        const result = await ctx.fns.cron.runOne({ id: Number(job.id) });
        expect(result.status).toBe("done");
        const rows = await ctx.fns.procs.db.select({ sql: "SELECT status, result FROM cron_jobs WHERE name = ? ORDER BY id", params: [name] });
        expect(rows.map((row: any) => row.status)).toEqual(["done", "pending"]);
        expect(rows[0].result.value).toBe(42);
    });
});
