// The module manager: what is mounted, what the project asked for but has not
// got, and what the machine could offer. A module is one folder with up to four
// faces — library, tab, skill, service provider — and the badges below are read
// off its files, not declared anywhere.
export default async function (ctx: Context, _session: Session | null, opts: {message?: string; error?: string }): Promise<string> {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    // What this page is about: the containers a project turns on and off. The
    // rest of what is mounted — the framework, this host's own src, the project
    // it supervises, the libraries the host ships — is the process itself, and
    // listing it here as something to manage is how a module manager ends up
    // showing "app" three times.
    const all = ctx.fns.procs.modules.list({});
    const mounted = all.filter((m: any) => m.plugin);
    const parts = all.filter((m: any) => !m.plugin);
    const declared = await ctx.fns.procs.modules.readDeclared({ workdir: ctx.fns.procs.project.workdir({}) });
    const missing = Object.entries(declared).filter(([name, config]) => config !== false && !mounted.some(m => m.name === name)) as Array<[string, Record<string, any>]>;
    const catalog = await ctx.fns.procs.modules.catalog({});
    // A module that refused to start is the answer to "why is nothing happening":
    // the host stayed up without it, and this is where it says so.
    const failed = Object.entries((ctx.state.procs.lifecycle?.failed ?? {}) as Record<string, string>);

    const trouble = failed.length
        ? ctx.fns.procs.ui.notice({
            tone: "danger",
            text: `did not start: ${failed.map(([name, why]) => `${name} — ${why}`).join(" · ")}`,
        })
        : "";

    // A module is a card, not a row of cells: an icon, a line of badges, a
    // description and a path — so the markup stays here and only the parts that
    // are the shared thing (badges, buttons, the box, the page) come from ui.
    const module = (p: (typeof mounted)[number]) => `<div ${ctx.fns.procs.ui.attr({ entity: "module", id: p.name, status: "on" })} class="flex items-start gap-3 border-t border-base-300 px-4 py-3">
  <i class="ph ${esc(p.icon)} mt-0.5 text-base text-base-content/60" aria-hidden="true"></i>
  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-2">
      ${p.tab ? `<a ${ctx.fns.procs.ui.attr({ role: "label" })} class="font-medium text-primary hover:underline" href="/${esc(p.namespaces[0] ?? p.name)}">${esc(p.label)}</a>` : `<span ${ctx.fns.procs.ui.attr({ role: "label" })} class="font-medium">${esc(p.label)}</span>`}
      <span ${ctx.fns.procs.ui.attr({ role: "namespace" })} class="font-mono text-xs text-base-content/60">${esc(p.namespaces.join(" "))}</span>
      ${ctx.fns.procs.ui.badge({ text: p.source, role: "source" })}
      ${p.tab ? ctx.fns.procs.ui.badge({ text: "tab", tone: "info" }) : ""}
      ${p.skill ? `<a class="ui-focusable" href="/procs/modules/skill?name=${encodeURIComponent(p.name)}" hx-get="/procs/modules/skill?name=${encodeURIComponent(p.name)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true" title="Read this module's SKILL.md — the page the agent reads before touching it">${ctx.fns.procs.ui.badge({ text: "skill", tone: "success" })}</a>` : ""}
      ${p.provides.map(s => ctx.fns.procs.ui.badge({ text: `service:${s}`, tone: "warning" })).join("")}
      ${p.preview ? ctx.fns.procs.ui.badge({ text: `previews ${p.preview.files}`, tone: "info" }) : ""}
      ${p.fns.length ? ctx.fns.procs.ui.badge({ text: `${p.fns.length} fns` }) : ""}
    </div>
    ${p.description ? `<div class="mt-0.5 text-xs text-base-content/70">${esc(p.description)}</div>` : ""}
    <div ${ctx.fns.procs.ui.attr({ role: "dir" })} class="mt-0.5 truncate font-mono text-xs text-base-content/40" title="${esc(p.dir)}">${esc(p.dir)}</div>
    ${Object.keys(p.config).length ? `<div class="mt-1 font-mono text-xs text-base-content/60">${esc(JSON.stringify(p.config))}</div>` : ""}
  </div>
  ${!p.optional ? `<span class="shrink-0 text-xs text-base-content/40">always on</span>`
        : ctx.fns.procs.ui.button({ action: "turn-off", label: "Turn off", entity: "module", id: p.name, post: "/procs/modules/remove", vals: { name: p.name }, tone: "danger" })}
</div>`;

    const gap = ([name, config]: [string, Record<string, any>]) => `<div ${ctx.fns.procs.ui.attr({ entity: "module", id: name, status: "declared" })} class="flex items-center gap-3 border-t border-base-300 px-4 py-3">
  <i class="ph ph-warning-circle text-base text-warning" aria-hidden="true"></i>
  <div class="min-w-0 flex-1">
    <div ${ctx.fns.procs.ui.attr({ role: "namespace" })} class="font-medium">${esc(name)}</div>
    <div ${ctx.fns.procs.ui.attr({ role: "source" })} class="font-mono text-xs text-base-content/60">${esc(config.git ?? config.path ?? "no git or path — and nothing by that name in the catalogue")}</div>
  </div>
  ${config.git ? ctx.fns.procs.ui.button({ action: "fetch", label: "Fetch", entity: "module", id: name, post: "/procs/modules/fetch", vals: { name } }) : ""}
  ${ctx.fns.procs.ui.button({ action: "turn-off", label: "Turn off", entity: "module", id: name, post: "/procs/modules/remove", vals: { name }, tone: "danger" })}
</div>`;

    const available = (p: (typeof catalog)[number]) => `<div ${ctx.fns.procs.ui.attr({ entity: "module", id: p.name, status: "off" })} class="flex items-center gap-3 border-t border-base-300 px-4 py-3">
  <i class="ph ${esc(p.icon)} text-base text-base-content/60" aria-hidden="true"></i>
  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-2"><span ${ctx.fns.procs.ui.attr({ role: "label" })} class="font-medium">${esc(p.label)}</span><span ${ctx.fns.procs.ui.attr({ role: "namespace" })} class="font-mono text-xs text-base-content/60">${esc(p.name)}</span>${p.skill ? ctx.fns.procs.ui.badge({ text: "skill", tone: "success" }) : ""}</div>
    ${p.description ? `<div class="mt-0.5 text-xs text-base-content/70">${esc(p.description)}</div>` : ""}
    <div ${ctx.fns.procs.ui.attr({ role: "dir" })} class="mt-0.5 truncate font-mono text-xs text-base-content/40">${esc(p.dir)}</div>
  </div>
  <button class="shrink-0 rounded-md border border-base-300 px-2 py-1 text-xs hover:border-brand hover:bg-primary/10 hover:text-primary" ${ctx.fns.procs.ui.attr({ action: "turn-on", entity: "module", id: p.name })}
    hx-post="/procs/modules/add" hx-vals='{"name":${JSON.stringify(p.name)}}' hx-target="#main" hx-swap="innerHTML">Turn on</button>
</div>`;

    return ctx.fns.procs.ui.page({
        page: "modules",
        title: "Modules",
        lead: `A module is a folder: its functions are a library, a <span class="font-mono">GET /namespace</span> route makes it a tab, a <span class="font-mono">SKILL.md</span> makes it a skill for the agent. The workspace's own are always on; the rest are named in <span class="font-mono">workspace.json</span>.`,
        main: `
${trouble ? `<div class="mt-4">${trouble}</div>` : ""}
${opts.error ? `<div class="mt-4">${ctx.fns.procs.ui.notice({ text: opts.error, tone: "danger" })}</div>` : ""}
${opts.message ? `<div class="mt-4">${ctx.fns.procs.ui.notice({ text: opts.message, tone: "success" })}</div>` : ""}
${ctx.fns.procs.ui.box({ class: "mt-4", title: `${mounted.length} on`, body: mounted.map(module).join(""), empty: "no plugins on — the catalogue is below" })}
${missing.length ? ctx.fns.procs.ui.box({ class: "mt-4", title: `${missing.length} declared, not mounted`, body: missing.map(gap).join(""), empty: "" }) : ""}
${ctx.fns.procs.ui.box({ class: "mt-4", title: `${catalog.length} available — off`, body: catalog.map(available).join(""), empty: "every module on this machine is already on" })}

${ctx.fns.procs.ui.box({
            class: "mt-4", title: `${parts.length} always on — this process`,
            // The same rows as everything above, not a run of names in a
            // paragraph: these are the modules a person is most likely to want
            // to read about — they are the ones nobody chose and nobody can turn
            // off — and half of them ship a skill that was unreachable from here.
            body: parts.map(module).join(""),
        })}

${ctx.fns.procs.ui.form({
            form: "module-add", post: "/procs/modules/add", class: "mt-4 flex items-center gap-2",
            body: ctx.fns.procs.ui.field({ name: "name", placeholder: "name", class: "w-40" })
                + ctx.fns.procs.ui.field({ name: "git", placeholder: "https://github.com/acme/module (leave empty for a platform module)" })
                + ctx.fns.procs.ui.button({ action: "add", label: "Add", tone: "primary" }),
        })}`,
    });
}
