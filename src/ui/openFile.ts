export default async function (ctx: Context, opts: { path: string }) {
    const resolved = await ctx.fns.files.resolveSafe(ctx, { path: opts.path });
    ctx.fns.files.open(ctx, { path: resolved });
    return { opened: resolved };
}
