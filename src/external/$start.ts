/** Mint scoped external-harness credentials before HTTP begins accepting requests. */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<void> {
    await ctx.fns.external.token({});
    await ctx.fns.external.replToken({});
}
