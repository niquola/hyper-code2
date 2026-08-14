// Scaffold a new function file, hot-load it, regenerate types.
//   ctx.fns.procs.generate.fn({ module: "todo", name: "list" })
//   → src/todo/list.ts registered as ctx.fns.todo.list
/**
 * Perform fn for the generate subsystem.
 * @param opts.module The module value used by the operation.
 * @param opts.name The target name.
 * @param opts.body The HTTP body.
 */
export default async function (ctx: Context, _session: Session | null, opts: { module: string; name: string; body?: string }) {
    const { module: mod, name } = opts;
    if (!/^[a-zA-Z_][\w/]*$/.test(mod) || !/^[a-zA-Z_]\w*$/.test(name)) {
        throw new Error(`bad module/name: ${mod}/${name}`);
    }
    const rel = `${mod}/${name}.ts`;
    const abs = `${ctx.fns.procs.project.projectRoot({})}/src/${rel}`; // app src, not proc core
    if (await Bun.file(abs).exists()) throw new Error(`already exists: src/${rel}`);

    const body = opts.body ?? `    return { ok: true };`;
    const src = `export default async function (ctx: Context, session: Session | null, opts: any) {\n${body}\n}\n`;
    await Bun.write(abs, src);
    console.log(`[generate] fn src/${rel} → ctx.fns.${mod.replaceAll('/', '.')}.${name}`);

    await ctx.fns.procs.repl.load({ name: `${mod.replaceAll('/', '.')}.${name}` });
    await ctx.fns.procs.dev.genTypes({});
    return { created: `src/${rel}`, fn: `ctx.fns.${mod.replaceAll('/', '.')}.${name}` };
}
