// Resolve a module's config: defaults < package.json proc.prod.<module> <
// workspace.json modules.<module> < env.
// ENV ENTERS THROUGH CONFIG — a module reads ctx.fns.procs.config.resolve, never
// ctx.env directly. Each param's env var is schema.env or <MODULE>__<KEY>.
// Coerced + validated; invalid config throws (so a bad $start fails loudly).
// Sync (readFileSync) so db.url() and friends stay synchronous.
import { readFileSync } from "node:fs";

const envify = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "_");

/**
 * Perform resolve for the config subsystem.
 * @param opts.module The module value used by the operation.
 * @param opts.schema The value schema.
 */
export default function (ctx: Context, _session: Session | null, opts: { module: string; schema?: ConfigSchema }) {
    const mod = opts.module;
    // Schema comes from ctx.state.procs?.config?.schemas (collected from module/$config.ts
    // at boot), so a module reads its config without importing anything.
    const schema = opts.schema ?? ctx.state.procs?.config?.schemas?.[mod];
    if (!schema) throw new Error(`config "${mod}": no schema — add ${mod}/$config.ts`);

    let fromPkg: Record<string, any> = {};
    try {
        const pkg = JSON.parse(readFileSync(ctx.fns.procs.project.projectRoot({}) + "/package.json", "utf8"));
        fromPkg = (pkg.procs ?? pkg.proc)?.prod?.[mod] ?? {};
    } catch { /* no package.json (e.g. prod bundle) → env-only */ }

    // A module is configured where it is asked for: `"aidbox": { "license": … }`
    // under `procs.modules`. That names a CONTAINER, so the config of the
    // container that delivered this module applies to it — including when the
    // container's name and the module's name differ. loadFns already put it on
    // the record, so this stays synchronous.
    const from = ctx.state.procs?.modules?.find(m => m.name === mod || m.namespaces.includes(mod));
    // …minus the keys that say where the module came FROM. `path`, `npm`, `git`
    // and `prefix` are instructions to the mounter, not settings of the module —
    // a module with a $config would otherwise refuse to start because somebody
    // told the host where to find it.
    const { path: _p, npm: _n, git: _g, prefix: _x, ...fromWorkspace } = (from?.config ?? {}) as Record<string, any>;

    const fromEnv: Record<string, any> = {};
    for (const [k, s] of Object.entries(schema)) {
        const name = s.env ?? `${envify(mod)}__${envify(k)}`;
        if (ctx.env[name] !== undefined) fromEnv[k] = ctx.env[name];
    }

    const merged = { ...fromPkg, ...fromWorkspace, ...fromEnv }; // env wins over the files
    const coerced = ctx.fns.procs.config.coerce({ schema, config: merged });
    const errors = ctx.fns.procs.config.validate({ schema, config: coerced });
    if (errors.length) throw new Error(`config "${mod}": ${errors.join("; ")}`);
    return coerced;
}
