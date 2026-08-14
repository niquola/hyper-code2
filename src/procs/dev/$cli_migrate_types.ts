// `bun script/cli.ts migrate:types` — rename every `$type_Name.ts` to `Name.ts`,
// which is how a type is written now. A rename is the whole migration: nothing
// imports a type file, so there are no references to fix.
import { rename } from "node:fs/promises";
import { dirname, basename, resolve } from "node:path";

/**
 * Run the cli migrate types command-line operation.
 * @param opts.dry The dry value used by the operation.
 */
export default async function (ctx: Context, _session: Session | null, opts: { dry?: boolean }): Promise<{ renamed: string[] }> {
    const renamed: string[] = [];
    const entries = await ctx.fns.procs.project.scan({});
    for (const entry of entries) {
        if (!entry.fileName.startsWith("$type_")) continue;
        const plain = basename(entry.fileName).slice("$type_".length);
        // On a case-insensitive filesystem `Query.ts` IS `query.ts`; a type whose
        // name is taken by a function keeps the old spelling rather than eating it.
        const taken = entries.some((o: any) => o.rel !== entry.rel && o.fileName.toLowerCase() === plain.toLowerCase() && o.moduleDir === entry.moduleDir);
        if (taken) { console.log(`keep       ${entry.rel}  —  ${plain} is taken by a function here`); continue; }
        const to = resolve(dirname(entry.abs), plain);
        console.log(`${opts.dry ? "would rename" : "rename"}  ${entry.rel}  →  ${entry.rel.replace(entry.fileName, basename(to))}`);
        if (!opts.dry) await rename(entry.abs, to);
        renamed.push(entry.rel);
    }
    if (!opts.dry && renamed.length) await ctx.fns.procs.dev.genTypes({});
    return { renamed };
}
