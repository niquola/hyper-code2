// Resolve a secret reference. Supported backends:
//   env://NAME                         — ctx.env
//   op://vault/item/field              — 1Password CLI
// Literal values remain supported for backwards-compatible settings.
// Sensitive values must never be logged or included in errors.
/**
 * Resolves an environment, 1Password, or legacy literal secret reference.
 * @param opts.ref Secret reference to resolve, or an empty value for no secret.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { ref: string | null | undefined },
): Promise<string | null> {
    const ref = opts.ref?.trim();
    if (!ref) return null;

    if (ref.startsWith("env://")) {
        const name = ref.slice("env://".length);
        if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error("invalid env secret reference");
        return ctx.env[name] ?? null;
    }

    if (ref.startsWith("op://")) {
        const home = ctx.env.HOME ?? process.env.HOME ?? "";
        const path = [`${home}/.local/bin`, "/opt/homebrew/bin", "/usr/local/bin", ctx.env.PATH ?? process.env.PATH ?? ""]
            .filter(Boolean).join(":");
        const proc = Bun.spawn(["op", "read", "--no-newline", ref], {
            stdout: "pipe",
            stderr: "pipe",
            env: { ...process.env, ...ctx.env, PATH: path },
        });
        const timeout = setTimeout(() => { try { proc.kill(9); } catch {} }, 15_000);
        const [stdout, stderr, code] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
            proc.exited,
        ]).finally(() => clearTimeout(timeout));
        if (code !== 0) {
            // stderr may contain identifying metadata; expose only a generic error.
            void stderr;
            throw new Error("1Password secret could not be resolved");
        }
        return stdout;
    }

    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(ref)) throw new Error("unsupported secret provider");
    return ref;
}
