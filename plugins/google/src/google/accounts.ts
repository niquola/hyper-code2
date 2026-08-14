// Authorized Google accounts are metadata stored separately from token values.
/**
 * List configured Google accounts.
 */
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const raw = await ctx.fns.secrets.resolve({ ref: "op://hyper/google/accounts" });
    if (!raw) return [];
    const accounts = JSON.parse(raw);
    return Array.isArray(accounts) ? accounts.filter((x): x is string => typeof x === "string") : [];
}
