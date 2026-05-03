export default async function (ctx: Context, opts: { path: string }): Promise<string> {
    const abs = ctx.fns.files.resolveSafe(ctx, { path: opts.path });
    return await Bun.file(abs).text();
}
