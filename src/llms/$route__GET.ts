// Unified LLM connections surface. Managed Anthropic OAuth is fully wired;
// other providers retain their existing settings/login flows.
/** Handles the HTTP route  GET endpoint. */
export default async function (ctx: Context, _session: Session | null, _opts: {
        /** Incoming HTTP request. */ req: Request;
        /** Route parameters captured from the request path. */ params: Record<string, string> }) {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: String(s ?? "") });
    const status = await ctx.fns.settings.status({});
    const oauth = status.anthropicOAuth;
    const pending: any = [...((ctx.state as any).llm?.anthropicOAuth?.pending?.values?.() ?? [])]
        .find((p: any) => p.expiresAt > Date.now() && (p.status === "pending" || p.status === "exchanging"));
    // authorizationUrl contains only public OAuth request values (state and
    // challenge). The verifier and credentials never leave procedure state.
    const authorizationUrl = pending?.authorizationUrl ? String(pending.authorizationUrl) : null;
    const connected = [
        status.codex.loggedIn, status.kimiCoding.loggedIn, oauth.connected,
        status.openai.set, status.anthropic.set, status.openrouter.set,
    ].filter(Boolean).length;

    const badge = (on: boolean, label?: string) => on
        ? `<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200"><span class="size-1.5 rounded-full bg-emerald-500"></span>${esc(label ?? "connected")}</span>`
        : `<span class="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1 text-[11px] text-gray-500 ring-1 ring-inset ring-gray-200"><span class="size-1.5 rounded-full bg-gray-300"></span>${esc(label ?? "not connected")}</span>`;
    const disabledButton = (text: string, primary = false) => `<button type="button" disabled title="Managed in Settings" class="cursor-not-allowed rounded-md px-3 py-1.5 text-xs ${primary ? "bg-gray-900 text-white opacity-45" : "border border-gray-200 bg-white text-gray-400"}">${esc(text)}</button>`;
    const staticCard = (opts: { icon: string; name: string; description: string; on: boolean; detail?: string; methods: string[] }) => `
<article class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
  <div class="flex items-start gap-3">
    <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg text-gray-700"><i class="ph ${opts.icon}"></i></div>
    <div class="min-w-0 flex-1"><div class="flex flex-wrap items-center justify-between gap-2"><h2 class="font-semibold text-gray-900">${esc(opts.name)}</h2>${badge(opts.on, opts.detail)}</div><p class="mt-1 text-xs leading-5 text-gray-500">${esc(opts.description)}</p></div>
  </div>
  <div class="mt-4 flex flex-wrap gap-2">${opts.methods.map((m, i) => disabledButton(m, i === 0)).join("")}</div>
</article>`;

    const oauthLabel = oauth.needsReconnect ? "reconnect required" : oauth.connected ? expiryLabel(oauth.expiresAt) : oauth.loginStatus === "pending" ? "login pending" : undefined;
    const oauthError = oauth.error
        ? `<div role="alert" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">${esc(oauth.error)}</div>` : "";
    const pendingPanel = pending ? `
<div class="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
  <div class="font-semibold">Authorization in progress</div>
  <p class="mt-1">Complete sign-in in the Anthropic tab. ${pending.callbackListening ? "The local callback is listening." : "The local callback is unavailable; use the manual fallback below."}</p>
  ${authorizationUrl ? `<a class="mt-2 inline-flex rounded-md border border-blue-300 bg-white px-3 py-1.5 font-medium text-blue-800 hover:bg-blue-50" target="_blank" rel="noreferrer" href="${esc(authorizationUrl)}">Open Anthropic authorization</a>` : ""}
  <form method="POST" action="/llms/anthropic-oauth/complete" class="mt-3 space-y-2">
    <label for="anthropic-authorization" class="block font-medium">Paste the final redirect URL or authorization code</label>
    <div class="flex flex-col gap-2 sm:flex-row"><input id="anthropic-authorization" name="authorization" required autocomplete="off" spellcheck="false" placeholder="http://localhost:53692/callback?code=…&state=…" class="min-w-0 flex-1 rounded-md border border-blue-200 bg-white px-3 py-2 font-mono text-xs"><button class="rounded-md bg-blue-700 px-3 py-2 font-medium text-white hover:bg-blue-800">Complete connection</button></div>
    <p class="text-[11px] text-blue-700">Use this when the callback opened on another machine or localhost could not be reached.</p>
  </form>
</div>` : "";
    const oauthActions = oauth.connected ? `
<form method="POST" action="/llms/anthropic-oauth/connect"><button class="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700">${oauth.needsReconnect ? "Reconnect" : "Connect another account"}</button></form>
<form method="POST" action="/llms/anthropic-oauth/logout"><button class="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50">Disconnect</button></form>` : `
<form method="POST" action="/llms/anthropic-oauth/connect"><button class="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700">${pending ? "Restart connection" : "Connect Claude Pro / Max"}</button></form>`;

    const oauthCard = `<article class="rounded-xl border ${oauth.connected ? "border-emerald-200" : "border-gray-200"} bg-white p-4 shadow-sm md:col-span-2">
  <div class="flex items-start gap-3"><div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-lg text-violet-700"><i class="ph ph-sparkle"></i></div><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center justify-between gap-2"><h2 class="font-semibold text-gray-900">Anthropic subscription</h2>${badge(oauth.connected && !oauth.needsReconnect, oauthLabel)}</div><p class="mt-1 text-xs leading-5 text-gray-500">Claude Pro or Max through managed OAuth. Agents use the <code>anthropic-oauth:</code> model prefix.</p></div></div>
  ${oauthError}${pendingPanel}
  <div class="mt-4 flex flex-wrap gap-2">${oauthActions}</div>
  ${oauth.connected ? `<p class="mt-3 text-[11px] text-gray-400">Disconnect removes the encrypted credential from hyper-code2; it does not revoke other Claude sessions.</p>` : ""}
</article>`;

    const main = `<div class="min-h-full bg-gray-50">
<header class="border-b border-gray-200 bg-white px-6 py-5"><div class="mx-auto flex max-w-5xl items-start justify-between gap-4"><div><h1 class="text-xl font-semibold tracking-tight text-gray-900">LLM connections</h1><p class="mt-1 text-sm text-gray-500">Connect accounts and API providers used by your agents.</p></div><div class="rounded-lg bg-gray-50 px-3 py-2 text-right ring-1 ring-gray-200"><div class="text-lg font-semibold text-gray-900">${connected}</div><div class="text-[10px] uppercase tracking-wide text-gray-400">available</div></div></div></header>
<div class="mx-auto max-w-5xl space-y-7 px-6 py-6">
<section><div class="mb-3"><h2 class="text-xs font-semibold uppercase tracking-wider text-gray-500">Subscriptions & CLI accounts</h2><p class="mt-1 text-xs text-gray-400">Managed OAuth is isolated from API-key billing and CLI credentials.</p></div><div class="grid gap-3 md:grid-cols-2">${oauthCard}${staticCard({ icon: "ph-terminal-window", name: "Codex", description: "ChatGPT subscription through the Codex backend.", on: status.codex.loggedIn, detail: status.codex.email ?? undefined, methods: [status.codex.loggedIn ? "Manage in Settings" : "Use Codex CLI login"] })}${staticCard({ icon: "ph-moon-stars", name: "Kimi Coding", description: "Kimi coding subscription using the Anthropic-compatible API.", on: status.kimiCoding.loggedIn, methods: [status.kimiCoding.loggedIn ? "Manage in Settings" : "Connect in Settings"] })}</div></section>
<section><div class="mb-3"><h2 class="text-xs font-semibold uppercase tracking-wider text-gray-500">API providers</h2><p class="mt-1 text-xs text-gray-400">API keys remain separately managed in Settings.</p></div><div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">${staticCard({ icon: "ph-sparkle", name: "Anthropic API", description: "Claude models billed through an Anthropic API key.", on: status.anthropic.set, methods: [status.anthropic.set ? "Manage key in Settings" : "Add key in Settings"] })}${staticCard({ icon: "ph-circles-three-plus", name: "OpenAI", description: "OpenAI platform models and billing.", on: status.openai.set, methods: [status.openai.set ? "Manage key in Settings" : "Add key in Settings"] })}${staticCard({ icon: "ph-git-fork", name: "OpenRouter", description: "Multiple model vendors through one API.", on: status.openrouter.set, methods: [status.openrouter.set ? "Manage key in Settings" : "Add key in Settings"] })}</div></section>
<aside class="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800"><strong>Credential isolation.</strong> Managed Anthropic tokens are encrypted before storage and never displayed. Existing API-key and Claude CLI authentication paths are unchanged. <a class="underline" href="/settings">Open Settings</a>.</aside>
</div></div>`;
    return { title: "LLMs", main };
}

function expiryLabel(expiresAt: number | null): string {
    if (!expiresAt) return "connected";
    const ms = expiresAt - Date.now();
    if (ms <= 0) return "reconnect required";
    const mins = Math.ceil(ms / 60_000);
    return mins < 120 ? `connected · ${mins}m` : `connected · ${Math.ceil(mins / 60)}h`;
}
