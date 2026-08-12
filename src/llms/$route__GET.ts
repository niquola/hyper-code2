// Design stub for the future LLM connections surface. Read-only on purpose:
// existing login/settings flows remain authoritative while the connection model
// is being designed.
export default async function (ctx: Context, _session: Session | null, _opts: { req: Request; params: Record<string, string> }) {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const status = await ctx.fns.settings.status({});
    const connected = [
        status.codex.loggedIn,
        status.kimiCoding.loggedIn,
        status.openai.set,
        status.anthropic.set,
        status.openrouter.set,
    ].filter(Boolean).length;

    const badge = (on: boolean, label?: string) => on
        ? `<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200"><span class="size-1.5 rounded-full bg-emerald-500"></span>${esc(label ?? "connected")}</span>`
        : `<span class="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1 text-[11px] text-gray-500 ring-1 ring-inset ring-gray-200"><span class="size-1.5 rounded-full bg-gray-300"></span>not connected</span>`;
    const button = (text: string, primary = false) => `<button type="button" disabled title="Design preview — actions are not wired yet" class="cursor-not-allowed rounded-md px-3 py-1.5 text-xs ${primary ? "bg-gray-900 text-white opacity-45" : "border border-gray-200 bg-white text-gray-400"}">${esc(text)}</button>`;
    const card = (opts: { icon: string; name: string; description: string; on: boolean; detail?: string; methods: string[] }) => `
<article class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
  <div class="flex items-start gap-3">
    <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg text-gray-700"><i class="ph ${opts.icon}"></i></div>
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center justify-between gap-2"><h2 class="font-semibold text-gray-900">${esc(opts.name)}</h2>${badge(opts.on, opts.detail)}</div>
      <p class="mt-1 text-xs leading-5 text-gray-500">${esc(opts.description)}</p>
    </div>
  </div>
  <div class="mt-4 flex flex-wrap gap-2">${opts.methods.map((m, i) => button(m, i === 0)).join("")}</div>
</article>`;

    const main = `<div class="min-h-full bg-gray-50">
  <header class="border-b border-gray-200 bg-white px-6 py-5">
    <div class="mx-auto flex max-w-5xl items-start justify-between gap-4">
      <div><h1 class="text-xl font-semibold tracking-tight text-gray-900">LLM connections</h1><p class="mt-1 text-sm text-gray-500">Connect accounts and API providers used by your agents.</p></div>
      <div class="rounded-lg bg-gray-50 px-3 py-2 text-right ring-1 ring-gray-200"><div class="text-lg font-semibold text-gray-900">${connected}</div><div class="text-[10px] uppercase tracking-wide text-gray-400">available</div></div>
    </div>
  </header>
  <div class="mx-auto max-w-5xl space-y-7 px-6 py-6">
    <section>
      <div class="mb-3"><h2 class="text-xs font-semibold uppercase tracking-wider text-gray-500">Subscriptions & CLI accounts</h2><p class="mt-1 text-xs text-gray-400">We still need to choose between reusing CLI credentials and managed OAuth.</p></div>
      <div class="grid gap-3 md:grid-cols-2">
        ${card({ icon: "ph-terminal-window", name: "Codex", description: "ChatGPT subscription through the Codex backend.", on: status.codex.loggedIn, detail: status.codex.email ?? undefined, methods: [status.codex.loggedIn ? "Manage connection" : "Use Codex CLI login", "Connect with OAuth"] })}
        ${card({ icon: "ph-moon-stars", name: "Kimi Coding", description: "Kimi coding subscription using the Anthropic-compatible API.", on: status.kimiCoding.loggedIn, methods: [status.kimiCoding.loggedIn ? "Manage connection" : "Use Kimi CLI login", "Connect with OAuth"] })}
      </div>
    </section>
    <section>
      <div class="mb-3"><h2 class="text-xs font-semibold uppercase tracking-wider text-gray-500">API providers</h2><p class="mt-1 text-xs text-gray-400">Keys are currently managed in Settings; these cards preview the unified flow.</p></div>
      <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        ${card({ icon: "ph-sparkle", name: "Anthropic", description: "Claude models via an Anthropic API key.", on: status.anthropic.set, methods: [status.anthropic.set ? "Manage key" : "Add API key"] })}
        ${card({ icon: "ph-circles-three-plus", name: "OpenAI", description: "OpenAI platform models and billing.", on: status.openai.set, methods: [status.openai.set ? "Manage key" : "Add API key"] })}
        ${card({ icon: "ph-git-fork", name: "OpenRouter", description: "Multiple model vendors through one API.", on: status.openrouter.set, methods: [status.openrouter.set ? "Manage key" : "Add API key"] })}
      </div>
    </section>
    <section class="rounded-xl border border-dashed border-gray-300 bg-white/60 p-5">
      <div class="flex items-center gap-3"><div class="flex size-9 items-center justify-center rounded-lg bg-gray-100"><i class="ph ph-hard-drives"></i></div><div><h2 class="font-medium text-gray-800">Local & custom endpoint</h2><p class="text-xs text-gray-500">LM Studio, Ollama or an OpenAI-compatible base URL.</p></div><span class="flex-1"></span>${button("Add endpoint")}</div>
    </section>
    <aside class="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800"><strong>Design preview.</strong> Buttons are intentionally disabled. Existing credentials are only detected and displayed; nothing has moved from <a class="underline" href="/settings">Settings</a>.</aside>
  </div>
</div>`;
    return { title: "LLMs", main };
}
