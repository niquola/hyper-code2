import { test, expect } from "bun:test";
import { testCtx } from "../$test";

const ctx = await testCtx();

test("cli.parse: command + --flags + positionals", () => {
    // schemaless: `--k v` takes a value; a trailing `--flag` (no following value) is boolean
    expect(ctx.fns.procs.cli.parse({ argv: ["db:seed", "--n", "5", "x", "--force"] }))
        .toEqual({ command: "db:seed", opts: { _: ["x"], n: "5", force: true } });
});

test("cli.parse: a negative number is a flag value, not a boolean", () => {
    expect(ctx.fns.procs.cli.parse({ argv: ["q", "--offset", "-5", "--limit", "10"] }))
        .toEqual({ command: "q", opts: { _: [], offset: "-5", limit: "10" } });
});

test("cli.run: dispatches $cli_<command> (fns) and help", async () => {
    const out = await ctx.fns.procs.cli.run({ argv: ["fns"] });
    expect(Array.isArray(out)).toBe(true);
    expect(out.some((f: string) => f.startsWith("ctx.fns."))).toBe(true);

    const help = await ctx.fns.procs.cli.run({ argv: [] });
    expect(help.commands).toContain("fns");
    expect(help.commands).toContain("migrate");
});

// migrate:names — the codemod for a project written before the framework moved
// under `procs.*`. The rule that makes it safe is that it asks THIS registry:
// rewrite only where `procs.<ns>.<fn>` exists and `<ns>.<fn>` does not, so a
// mounted module that really ships a name keeps every one of its calls.
test("migrate:names rewrites only the calls the framework took over", async () => {
    const dir = `${process.env.TMPDIR ?? "/tmp"}/procs-migrate-${Bun.hash(import.meta.url)}`;
    await Bun.write(`${dir}/src/pages/board.ts`, [
        `export default async function (ctx: Context) {`,
        `    const rows = await ctx.fns.aidbox.request({ path: "/fhir/Patient" });`,
        `    return ctx.fns.ui.button({ label: String(rows.length) }) + ctx.fns.procs.ui.badge({ text: "x" });`,
        `}`,
    ].join("\n"));

    const dry = await ctx.fns.procs.cli.run({ argv: ["migrate:names", "--dir", dir] });
    expect(dry.calls).toBe(1);                                    // ui.button, not aidbox.request
    expect(await Bun.file(`${dir}/src/pages/board.ts`).text()).toContain("ctx.fns.ui.button");   // dry: untouched

    await ctx.fns.procs.cli.run({ argv: ["migrate:names", "--dir", dir, "--write"] });
    const after = await Bun.file(`${dir}/src/pages/board.ts`).text();
    expect(after).toContain("ctx.fns.procs.ui.button");
    expect(after).toContain("ctx.fns.aidbox.request");             // nobody else's names are touched
    expect(after).not.toContain("ctx.fns.procs.procs.ui.badge");   // already-migrated calls stay put
    await Bun.$`rm -rf ${dir}`.quiet();
});
