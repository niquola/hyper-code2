import { timingSafeEqual } from "node:crypto";

/** Verifies a candidate against a configured Bun password hash or a plain development password. */
export default async function (ctx: Context, _session: Session | null, opts: { password: string }): Promise<boolean> {
    const configured = await ctx.fns.auth.password({});
    if (!configured || !opts.password) return false;
    if (configured.startsWith("$argon2") || configured.startsWith("$2")) {
        return Bun.password.verify(opts.password, configured).catch(() => false);
    }
    const left = new TextEncoder().encode(opts.password);
    const right = new TextEncoder().encode(configured);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
}
