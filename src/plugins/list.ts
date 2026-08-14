// Public, compact plugin catalogue for agents and UI code. Framework internals
// stay under procs.modules; callers normally start here.
/** Lists mounted plugins. */
export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    return (ctx.fns.procs.modules.list({}) as any[])
        .filter((module: any) => module.plugin)
        .map((module: any) => ({
            name: module.name,
            label: module.label,
            description: module.description,
            namespaces: module.namespaces,
            functions: module.fns.length,
            routes: module.routes.length,
            path: module.dir,
            hasSkill: Boolean(module.skill),
            source: module.source,
        }));
}
