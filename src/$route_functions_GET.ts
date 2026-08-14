/** GET /functions — searchable documentation for every function in the live runtime. */
export default async function (
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

    // Warm Shiki once before rendering cards concurrently; markdown.highlight
    // caches the highlighter, but simultaneous cold calls would each create one.
    if (docs.length) await ctx.fns.markdown.highlight({ code: "", lang: "typescript" });


    const cards = (await Promise.all(docs.map(async (meta: any) => {
        const properties = Object.entries(meta.paramsSchema?.properties ?? {}) as Array<[string, any]>;
        const required = new Set<string>(meta.paramsSchema?.required ?? []);
        const params = properties.map(([name, schema]) => `<div class="rounded-lg border border-gray-200 bg-white px-3 py-2"><div class="flex items-center gap-1"><code class="text-xs font-semibold text-indigo-700">${esc(name)}</code><span class="text-[10px] text-gray-400">${esc(schemaType(schema))}${required.has(name) ? " · required" : " · optional"}</span></div>${schema.description ? `<p class="mt-1 text-xs leading-5 text-gray-600">${esc(schema.description)}</p>` : ""}</div>`).join("");
        const optsType = String(meta.optsType || "{}").trim();
        const signature = `await ctx.fns.${meta.name}(\n${optsType.split("\n").map((line: string) => `  ${line}`).join("\n")}\n); // returns ${String(meta.returnType || "unknown").replace(/\s+/g, " ").trim()}`;
        const highlightedSignature = await ctx.fns.markdown.highlight({ code: signature, lang: "typescript" });
        return `<details ${ctx.fns.procs.ui.attr({ entity: "function", id: meta.name })} class="group rounded-xl border border-gray-200 bg-white shadow-sm open:ring-1 open:ring-indigo-100">
  <summary class="flex cursor-pointer list-none items-start gap-3 px-4 py-3 hover:bg-gray-50">
    <span class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><i class="ph ph-function"></i></span>
    <span class="min-w-0 flex-1"><code class="text-sm font-semibold text-gray-900">${esc(meta.name)}</code><span class="mt-1 block text-xs leading-5 text-gray-600">${esc(meta.summary || meta.doc || "No description")}</span></span>
    <i class="ph ph-caret-down mt-1 text-gray-400 transition-transform group-open:rotate-180"></i>
  </summary>
  <div class="space-y-4 border-t border-gray-200 px-4 py-4">
    ${meta.doc && meta.doc !== meta.summary ? `<p class="whitespace-pre-line text-sm leading-6 text-gray-700">${esc(meta.doc)}</p>` : ""}
    <div><div class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Signature</div><div class="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 text-xs [&_.shiki]:m-0 [&_.shiki]:bg-transparent! [&_.shiki]:p-3 [&_.shiki]:leading-5">${highlightedSignature}</div></div>
    <div><div class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Parameters</div><div class="grid gap-2 sm:grid-cols-2">${params || `<span class="text-xs text-gray-400">No options</span>`}</div></div>
    <div class="grid gap-3 sm:grid-cols-2"><div><div class="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Returns</div><code class="mt-1 block break-words rounded-md bg-gray-100 px-2.5 py-2 text-xs text-gray-700">${esc(meta.returnType)}</code></div><div><div class="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Source</div><a href="/files?path=${encodeURIComponent(meta.abs || meta.rel)}" class="mt-1 block break-words rounded-md bg-gray-100 px-2.5 py-2 font-mono text-xs text-indigo-700 hover:underline">${esc(meta.rel)}${meta.line ? `:${esc(meta.line)}` : ""}</a></div></div>
  </div>
</details>`;
    }))).join("");

    const namespaceOptions = namespaces.map(name => `<option value="${esc(name)}"${name === namespace ? " selected" : ""}>${esc(name)}</option>`).join("");
    return {
        title: q ? `functions: ${q}` : "functions",
        main: `<div class="bg-white p-6 text-gray-900 sm:p-8"><section ${ctx.fns.procs.ui.attr({ page: "functions" })} class="mx-auto max-w-5xl pb-10">
  <div class="flex flex-wrap items-end justify-between gap-4"><div><h1 class="text-2xl font-semibold tracking-tight text-gray-900">Runtime functions</h1><p class="mt-1 text-sm text-gray-600">Live documentation, parameter schemas, return types, and source locations.</p></div><span class="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">${docs.length}${q ? " matches" : " functions"}</span></div>
  <form method="GET" action="/functions" ${ctx.fns.procs.ui.attr({ form: "function-search" })} class="mt-6 grid gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_14rem_auto]">
    <label class="flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100"><i class="ph ph-magnifying-glass text-gray-400"></i><input name="q" value="${esc(q)}" placeholder="Search in English: send telegram message…" class="min-w-0 grow bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400" autofocus></label>
    <select name="namespace" class="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"><option value="">All namespaces</option>${namespaceOptions}</select>
    <button class="h-10 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-700">Search</button>
  </form>
  ${q ? `<p class="mt-2 text-xs text-gray-400">Runtime search works best with concise English keywords.</p>` : ""}
  <div class="mt-5 space-y-3">${cards || `<div class="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">No functions found.</div>`}</div>
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
