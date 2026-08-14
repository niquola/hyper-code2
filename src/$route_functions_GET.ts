/** GET /functions — searchable documentation for every function in the live runtime. */
export default function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Incoming request containing optional `q` and `namespace` filters. */
        req: Request;
        /** Route parameters supplied by the HTTP runtime. */
        params: Record<string, string>;
    },
) {
    const url = new URL(opts.req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const namespace = (url.searchParams.get("namespace") ?? "").trim();
    const esc = (value: any) => ctx.fns.procs.ui.escape({ text: String(value ?? "") });

    const compact = q
        ? ctx.fns.runtime.docs.search({ query: q, limit: 50 })
        : ctx.fns.runtime.docs.list({ namespace: namespace || undefined });
    const docs = compact
        .filter((item: any) => !namespace || item.name === namespace || item.name.startsWith(namespace + "."))
        .map((item: any) => ctx.fns.runtime.docs.get({ name: item.name }));
    const namespaces = [...new Set(ctx.fns.runtime.docs.list({}).map((item: any) => item.name.split(".").slice(0, -1).join(".")))]
        .filter(Boolean).sort();

    const cards = docs.map((meta: any) => {
        const properties = Object.entries(meta.paramsSchema?.properties ?? {}) as Array<[string, any]>;
        const required = new Set<string>(meta.paramsSchema?.required ?? []);
        const params = properties.map(([name, schema]) => `<div class="rounded-lg border border-base-300 bg-base-100 px-3 py-2"><div class="flex items-center gap-1"><code class="text-xs font-semibold text-primary">${esc(name)}</code><span class="text-[10px] text-base-content/35">${esc(schemaType(schema))}${required.has(name) ? " · required" : " · optional"}</span></div>${schema.description ? `<p class="mt-1 text-xs leading-5 text-base-content/55">${esc(schema.description)}</p>` : ""}</div>`).join("");
        return `<details ${ctx.fns.procs.ui.attr({ entity: "function", id: meta.name })} class="group rounded-xl border border-base-300 bg-base-100 shadow-xs open:ring-1 open:ring-primary/10">
  <summary class="flex cursor-pointer list-none items-start gap-3 px-4 py-3 hover:bg-base-200/40">
    <span class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><i class="ph ph-function"></i></span>
    <span class="min-w-0 flex-1"><code class="text-sm font-semibold">${esc(meta.name)}</code><span class="mt-1 block text-xs leading-5 text-base-content/55">${esc(meta.summary || meta.doc || "No description")}</span></span>
    <i class="ph ph-caret-down mt-1 text-base-content/35 transition-transform group-open:rotate-180"></i>
  </summary>
  <div class="space-y-4 border-t border-base-200 px-4 py-4">
    ${meta.doc && meta.doc !== meta.summary ? `<p class="whitespace-pre-line text-sm leading-6 text-base-content/65">${esc(meta.doc)}</p>` : ""}
    <div><div class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-base-content/35">Parameters</div><div class="grid gap-2 sm:grid-cols-2">${params || `<span class="text-xs text-base-content/40">No options</span>`}</div></div>
    <div class="grid gap-3 sm:grid-cols-2"><div><div class="text-[10px] font-semibold uppercase tracking-wider text-base-content/35">Returns</div><code class="mt-1 block break-words rounded-md bg-base-200 px-2.5 py-2 text-xs text-base-content/65">${esc(meta.returnType)}</code></div><div><div class="text-[10px] font-semibold uppercase tracking-wider text-base-content/35">Source</div><a href="/files?path=${encodeURIComponent(meta.abs || meta.rel)}" class="mt-1 block break-words rounded-md bg-base-200 px-2.5 py-2 font-mono text-xs text-primary hover:underline">${esc(meta.rel)}${meta.line ? `:${esc(meta.line)}` : ""}</a></div></div>
  </div>
</details>`;
    }).join("");

    const namespaceOptions = namespaces.map(name => `<option value="${esc(name)}"${name === namespace ? " selected" : ""}>${esc(name)}</option>`).join("");
    return {
        title: q ? `functions: ${q}` : "functions",
        main: `<div class="p-6 sm:p-8"><section ${ctx.fns.procs.ui.attr({ page: "functions" })} class="mx-auto max-w-5xl pb-10">
  <div class="flex flex-wrap items-end justify-between gap-4"><div><h1 class="text-2xl font-semibold tracking-tight">Runtime functions</h1><p class="mt-1 text-sm text-base-content/55">Live documentation, parameter schemas, return types, and source locations.</p></div><span class="rounded-full bg-base-200 px-3 py-1 text-xs text-base-content/55">${docs.length}${q ? " matches" : " functions"}</span></div>
  <form method="GET" action="/functions" ${ctx.fns.procs.ui.attr({ form: "function-search" })} class="mt-6 grid gap-2 rounded-xl border border-base-300 bg-base-100 p-3 shadow-xs sm:grid-cols-[minmax(0,1fr)_14rem_auto]">
    <label class="input input-bordered flex items-center gap-2"><i class="ph ph-magnifying-glass text-base-content/35"></i><input name="q" value="${esc(q)}" placeholder="Search in English: send telegram message…" class="grow" autofocus></label>
    <select name="namespace" class="select select-bordered w-full"><option value="">All namespaces</option>${namespaceOptions}</select>
    <button class="btn btn-primary">Search</button>
  </form>
  ${q ? `<p class="mt-2 text-xs text-base-content/40">Runtime search works best with concise English keywords.</p>` : ""}
  <div class="mt-5 space-y-3">${cards || `<div class="rounded-xl border border-dashed border-base-300 px-4 py-10 text-center text-sm text-base-content/45">No functions found.</div>`}</div>
</section></div>`,
    };
}

function schemaType(schema: any): string {
    if (schema?.["x-typescript-type"]) return schema["x-typescript-type"];
    if (schema?.type === "array") return `${schemaType(schema.items)}[]`;
    if (Array.isArray(schema?.enum)) return schema.enum.map((value: any) => JSON.stringify(value)).join(" | ");
    if (schema?.anyOf) return schema.anyOf.map(schemaType).join(" | ");
    return schema?.type || "unknown";
}
