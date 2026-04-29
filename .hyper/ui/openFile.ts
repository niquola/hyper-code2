export default async function (ctx: Context, path: string) {
    const resolved = await ctx.fns.files.resolveSafe(ctx, path);
    ctx.fns.files.open(ctx, resolved);
    return { opened: resolved };
}
