// Where a url an app wrote about ITSELF actually points.
//
// A project cannot know the name it will be mounted under: in the workspace that
// builds it, it IS `app`, so its own pages, forms and links are written `/app/…`.
// Installed into a host under a prefix, the same string has to point at where
// this copy landed — `/ehr/…`, `/demo1/…`. The caller's namespace is on the ctx
// it is called through (boot/load.ts `selfAware`), so nothing has to be passed.
//
//   post: ctx.fns.procs.project.selfUrl({ path: `/app/patients/${id}/phq9` })
//
// Anything else — an absolute url, a path that is not the app's own — is left
// exactly as it is.
export default function (ctx: Context, _session: Session | null, opts: { path?: string }): string | undefined {
    const ns = (ctx as any).namespace;
    if (!opts.path || !ns || ns === "app" || !opts.path.startsWith("/app/")) return opts.path;
    return `/${ns}/${opts.path.slice("/app/".length)}`;
}
