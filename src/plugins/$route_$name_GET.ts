// GET /plugins/:name — one plugin's readable detail page.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { req: Request; params: Record<string, string> },
) {
    const name = opts.params.name!;
    const module = ctx.fns.procs.modules.list({}).find((item: any) => item.name === name);
    if (!module) return new Response("Plugin not found", { status: 404 });
    const esc = (value: any) => ctx.fns.procs.ui.escape({ text: value });
    const root = ctx.fns.procs.project.projectRoot({});
    const path = module.dir.startsWith(root + "/") ? "./" + module.dir.slice(root.length + 1) : module.dir;
    const chip = (value: string) => `<span class="rounded-md bg-base-200 px-2 py-1 font-mono text-xs text-base-content/65">${esc(value)}</span>`;
    const functionRows = module.fns.map((fn: string) => `<li class="flex items-center gap-2 border-t border-base-200 px-3 py-2 first:border-t-0"><i class="ph ph-function shrink-0 text-base-content/35"></i><code class="min-w-0 truncate text-xs text-base-content/75">${esc(fn)}</code></li>`).join("");
    const rows = [
        ["Location", `<span class="font-mono text-xs">${esc(path)}</span>`],
        ["Source", esc(module.source)],
        ["Functions", String(module.fns.length)],
        ["Routes", String(module.routes.length)],
        ["Status", module.plugin ? `<span class="inline-flex items-center gap-1 text-success"><span class="size-1.5 rounded-full bg-success"></span>active</span>` : "always loaded"],
    ];
    let skillHtml = "";
    if (module.skill) {
        const text = await Bun.file(module.skill).text().catch(() => null);
        if (text !== null) {
            const rendered = await ctx.fns.markdown.render({ source: text });
            skillHtml = `<section class="mt-7"><div class="mb-3 flex items-center justify-between gap-3"><div><h2 class="font-medium">SKILL.md</h2><p class="mt-0.5 text-xs text-base-content/50">Instructions available to the agent</p></div><a href="/procs/modules/skill?name=${encodeURIComponent(module.name)}" class="text-xs text-base-content/45 hover:text-primary">Open separately <i class="ph ph-arrow-up-right"></i></a></div><article class="md-preview prose prose-sm max-w-none rounded-xl border border-base-300 bg-base-100 px-5 py-4 text-base-content">${rendered}</article></section>`;
        }
    }
    return { title: module.label, main: `<div class="p-6 sm:p-8"><section ${ctx.fns.procs.ui.attr({ page: "plugin", id: name })} class="max-w-4xl pb-10">
  <a href="/plugins" class="inline-flex items-center gap-1 text-xs text-base-content/45 hover:text-primary"><i class="ph ph-arrow-left"></i> Plugins</a>
  <div class="mt-5 flex items-start gap-4"><div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-base-200 text-base-content/70"><i class="ph ${esc(module.icon)} text-2xl"></i></div><div class="min-w-0 flex-1"><h1 class="text-2xl font-semibold tracking-tight">${esc(module.label)}</h1><p class="mt-1 max-w-2xl text-sm leading-6 text-base-content/60">${esc(module.description || "No description provided.")}</p></div>${module.plugin && module.optional ? ctx.fns.procs.ui.button({ action: "turn-off", label: "Turn off", entity: "module", id: module.name, post: "/procs/modules/remove", vals: { name: module.name }, tone: "danger" }) : ""}</div>
  <dl class="mt-7 overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-xs">${rows.map(([label, value]) => `<div class="grid grid-cols-[8rem_minmax(0,1fr)] gap-4 border-t border-base-200 px-4 py-3 first:border-t-0"><dt class="text-xs text-base-content/45">${label}</dt><dd class="min-w-0 break-words text-sm text-base-content/75">${value}</dd></div>`).join("")}</dl>
  <section class="mt-7"><h2 class="text-xs font-semibold uppercase tracking-wider text-base-content/45">Namespaces</h2><div class="mt-3 flex flex-wrap gap-2">${module.namespaces.map(chip).join("") || `<span class="text-sm text-base-content/45">None</span>`}</div></section>
  ${skillHtml}
  <section class="mt-7"><div class="mb-3 flex items-center justify-between"><h2 class="text-xs font-semibold uppercase tracking-wider text-base-content/45">Functions</h2><span class="text-xs text-base-content/40">${module.fns.length}</span></div><ul class="overflow-hidden rounded-xl border border-base-300 bg-base-100">${functionRows || `<li class="px-3 py-3 text-sm text-base-content/45">No functions</li>`}</ul></section>
</section></div>` };
}
