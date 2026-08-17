import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";
import page from "./$route__GET";
import add from "./$route_add_POST";
import runNow from "./$route_run-now_POST";
import remove from "./$route_remove_POST";

let ctx: any;
const names: string[] = [];
const request = (path: string, data: Record<string, string>) => new Request(`http://localhost${path}`, { method: "POST", body: new URLSearchParams(data) });

beforeAll(async () => {
    ctx = await mkTestCtx();
    await ctx.fns.procs.migrate.up({});
});

afterAll(async () => {
    for (const name of names) await ctx.fns.procs.db.run({ sql: "DELETE FROM cron_jobs WHERE name = ?", params: [name] });
    await ctx.fns.procs.db.close?.({});
});

describe("cron routes", () => {
    test("page renders forms and live jobs panel", async () => {
        const result: any = await page(ctx, null, { req: new Request("http://localhost/cron"), params: {} });
        expect(result.title).toBe("cron");
        expect(result.main).toContain("Cron tasks");
        expect(result.main).toContain('hx-post="/cron/add"');
        expect(result.main).toContain('id="cron-jobs"');
    });

    test("add action creates a task and returns the panel", async () => {
        const name = `ui-add-${crypto.randomUUID()}`; names.push(name);
        const response = await add(ctx, null, { req: request("/cron/add", { name, fn: "cron.list", every: "1h", args: "{\"limit\":2}" }) });
        expect(response.status).toBe(200);
        expect(await response.text()).toContain(`Scheduled ${name}`);
        const rows = await ctx.fns.procs.db.select({ sql: "SELECT args FROM cron_jobs WHERE name = ?", params: [name] });
        expect(rows[0].args.limit).toBe(2);
    });

    test("run-now and remove actions mutate pending task", async () => {
        const name = `ui-actions-${crypto.randomUUID()}`; names.push(name);
        await ctx.fns.cron.add({ name, fn: "cron.list", every: "1h" });
        const runResponse = await runNow(ctx, null, { req: request("/cron/run-now", { name }) });
        expect(runResponse.status).toBe(200);
        const due = await ctx.fns.procs.db.select({ sql: "SELECT run_at FROM cron_jobs WHERE name = ? AND status = 'pending'", params: [name] });
        expect(Number(due[0].run_at)).toBeLessThanOrEqual(Date.now());
        const removeResponse = await remove(ctx, null, { req: request("/cron/remove", { name }) });
        expect(removeResponse.status).toBe(200);
        const left = await ctx.fns.procs.db.select({ sql: "SELECT id FROM cron_jobs WHERE name = ? AND status = 'pending'", params: [name] });
        expect(left).toHaveLength(0);
    });

    test("add action shows validation errors", async () => {
        const response = await add(ctx, null, { req: request("/cron/add", { name: "bad", fn: "cron.list", every: "nope", args: "{}" }) });
        expect(response.status).toBe(400);
        expect(await response.text()).toContain("invalid interval");
    });
});
