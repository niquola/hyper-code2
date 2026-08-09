export default async function (ctx: Context, _session: Session | null, opts: { path: string }) {
    const resolved = ctx.fns.files.resolveSafe({ path: opts.path });
    ctx.fns.files.open({ path: resolved });
    return { opened: resolved };
}
