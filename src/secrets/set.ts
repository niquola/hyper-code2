/**
 * Store a secret value under a secret://namespace/name reference in encrypted local storage
 *
 * Writes the value into encrypted Postgres storage and returns only the reference,
 * so later calls (bash secrets option, secrets.get) can use the value without it
 * ever appearing in the transcript. Use this to persist a value the agent already
 * holds in memory (for example inside one eval right after secureInput.prompt);
 * prefer secureInput.prompt({ saveAs }) when the human should type it directly.
 * The plain value is never logged, returned or included in errors.
 * @param opts.ref Destination reference in the form secret://namespace/name.
 * @param opts.value Plain-text secret value to encrypt and persist.
 * @param opts.source Origin metadata recorded with the entry. @default agent
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Destination reference in the form secret://namespace/name. */
        ref: string;
        /** Plain-text secret value to encrypt and persist. */
        value: string;
        /** Origin metadata recorded with the entry. @default agent */
        source?: string;
    },
): Promise<{ ref: string; version: number }> {
    const { namespace, name } = ctx.fns.secrets.parseRef({ ref: opts.ref });
    const value = String(opts.value ?? "");
    if (!value) throw new Error("secret value is required");
    const result = await ctx.fns.secrets.putLocal({ namespace, name, value, source: String(opts.source ?? "agent") });
    const root = ((ctx.state as any).secrets ??= {});
    const cache: Map<string, string> = (root.values ??= new Map());
    cache.set(`${namespace}/${name}`, value);
    return { ref: `secret://${namespace}/${name}`, version: result.version };
}
