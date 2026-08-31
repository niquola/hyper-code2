/**
 * Read and decrypt one locally persisted runtime secret
 *
 * Returns a decrypted local secret or null without contacting external providers. Use before any 1Password bootstrap fallback.
 * @param opts.namespace Logical secret namespace.
 * @param opts.name Stable secret key.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Logical secret namespace. */
        namespace: string;
        /** Stable secret key. */
        name: string;
    },
): Promise<string | null> {
    const namespace = String(opts.namespace ?? "").trim();
        const name = String(opts.name ?? "").trim();
        const rows = await ctx.fns.procs.db.select({ sql: "SELECT value_enc FROM local_secrets WHERE namespace=? AND name=?", params: [namespace,name] }) as any[];
        if (!rows[0]) return null;
        return ctx.fns.secrets.decryptLocal({ namespace, name, envelope: String(rows[0].value_enc) });
}
