export default async function (ctx: Context, path: string): Promise<string> {
    const abs = ctx.fns.files.resolveSafe(ctx, path);
    return await Bun.file(abs).text();
}
