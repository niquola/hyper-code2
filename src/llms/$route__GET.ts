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
        ? `<span class="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[11px] font-medium text-success ring-1 ring-inset ring-success/30"><span class="size-1.5 rounded-full bg-success/100"></span>${esc(label ?? "connected")}</span>`
        : `<span class="inline-flex items-center gap-1 rounded-full bg-base-200 px-2 py-1 text-[11px] text-base-content/55 ring-1 ring-inset ring-base-300"><span class="size-1.5 rounded-full bg-base-300"></span>${esc(label ?? "not connected")}</span>`;
    const disabledButton = (text: string, primary = false) => `<button type="button" disabled title="Managed in Settings" class="cursor-not-allowed rounded-md px-3 py-1.5 text-xs ${primary ? "bg-primary text-primary-content opacity-45" : "border border-base-300 bg-base-100 text-base-content/45"}">${esc(text)}</button>`;
    const staticCard = (opts: { icon: string; name: string; description: string; on: boolean; detail?: string; methods: string[] }) => `
<article class="rounded-xl border border-base-300 bg-base-100 p-4 shadow-sm">
  <div class="flex items-start gap-3">
    <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-base-200 text-lg text-base-content/75"><i class="ph ${opts.icon}"></i></div>
    <div class="min-w-0 flex-1"><div class="flex flex-wrap items-center justify-between gap-2"><h2 class="font-semibold text-base-content">${esc(opts.name)}</h2>${badge(opts.on, opts.detail)}</div><p class="mt-1 text-xs leading-5 text-base-content/55">${esc(opts.description)}</p></div>
  </div>
  <div class="mt-4 flex flex-wrap gap-2">${opts.methods.map((m, i) => disabledButton(m, i === 0)).join("")}</div>
</article>`;

    const oauthLabel = oauth.needsReconnect ? "reconnect required" : oauth.connected ? expiryLabel(oauth.expiresAt) : oauth.loginStatus === "pending" ? "login pending" : undefined;
    const oauthError = oauth.error
        ? `<div role="alert" class="mt-4 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">${esc(oauth.error)}</div>` : "";
    const pendingPanel = pending ? `
<div class="mt-4 rounded-lg border border-info/30 bg-info/10 p-3 text-xs leading-5 text-info-content">
  <div class="font-semibold">Authorization in progress</div>
  <p class="mt-1">Complete sign-in in the Anthropic tab. ${pending.callbackListening ? "The local callback is listening." : "The local callback is unavailable; use the manual fallback below."}</p>
  ${authorizationUrl ? `<a class="mt-2 inline-flex rounded-md border border-info/40 bg-base-100 px-3 py-1.5 font-medium text-info hover:bg-info/15" target="_blank" rel="noreferrer" href="${esc(authorizationUrl)}">Open Anthropic authorization</a>` : ""}
  <form method="POST" action="/llms/anthropic-oauth/complete" class="mt-3 space-y-2">
    <label for="anthropic-authorization" class="block font-medium">Paste the final redirect URL or authorization code</label>
    <div class="flex flex-col gap-2 sm:flex-row"><input id="anthropic-authorization" name="authorization" required autocomplete="off" spellcheck="false" placeholder="http://localhost:53692/callback?code=…&state=…" class="min-w-0 flex-1 rounded-md border border-info/30 bg-base-100 px-3 py-2 font-mono text-xs"><button class="rounded-md bg-info px-3 py-2 font-medium text-primary-content hover:bg-info/80">Complete connection</button></div>
    <p class="text-[11px] text-blue-700">Use this when the callback opened on another machine or localhost could not be reached.</p>
  </form>
</div>` : "";
    const oauthActions = oauth.connected ? `
<form method="POST" action="/llms/anthropic-oauth/connect"><button class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-content hover:bg-primary/80">${oauth.needsReconnect ? "Reconnect" : "Connect another account"}</button></form>
<form method="POST" action="/llms/anthropic-oauth/logout"><button class="rounded-md border border-red-200 bg-base-100 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50">Disconnect</button></form>` : `
<form method="POST" action="/llms/anthropic-oauth/connect"><button class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-content hover:bg-primary/80">${pending ? "Restart connection" : "Connect Claude Pro / Max"}</button></form>`;

    const oauthCard = `<article class="rounded-xl border ${oauth.connected ? "border-emerald-200" : "border-base-300"} bg-base-100 p-4 shadow-sm md:col-span-2">
  <div class="flex items-start gap-3"><div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-lg text-violet-700"><i class="ph ph-sparkle"></i></div><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center justify-between gap-2"><h2 class="font-semibold text-base-content">Anthropic subscription</h2>${badge(oauth.connected && !oauth.needsReconnect, oauthLabel)}</div><p class="mt-1 text-xs leading-5 text-base-content/55">Claude Pro or Max through managed OAuth. Agents use the <code>anthropic-oauth:</code> model prefix.</p></div></div>
  ${oauthError}${pendingPanel}
  <div class="mt-4 flex flex-wrap gap-2">${oauthActions}</div>
  ${oauth.connected ? `<p class="mt-3 text-[11px] text-base-content/45">Disconnect removes the encrypted credential from hyper-code2; it does not revoke other Claude sessions.</p>` : ""}
</article>`;

    const main = `<div class="min-h-full bg-base-200">
<header class="border-b border-base-300 bg-base-100 px-6 py-5"><div class="mx-auto flex max-w-5xl items-start justify-between gap-4"><div><h1 class="text-xl font-semibold tracking-tight text-base-content">LLM connections</h1><p class="mt-1 text-sm text-base-content/55">Connect accounts and API providers used by your agents.</p></div><div class="rounded-lg bg-base-200 px-3 py-2 text-right ring-1 ring-base-300"><div class="text-lg font-semibold text-base-content">${connected}</div><div class="text-[10px] uppercase tracking-wide text-base-content/45">available</div></div></div></header>
<div class="mx-auto max-w-5xl space-y-7 px-6 py-6">
<section><div class="mb-3"><h2 class="text-xs font-semibold uppercase tracking-wider text-base-content/55">Subscriptions & CLI accounts</h2><p class="mt-1 text-xs text-base-content/45">Managed OAuth is isolated from API-key billing and CLI credentials.</p></div><div class="grid gap-3 md:grid-cols-2">${oauthCard}${staticCard({ icon: "ph-terminal-window", name: "Codex", description: "ChatGPT subscription through the Codex backend.", on: status.codex.loggedIn, detail: status.codex.email ?? undefined, methods: [status.codex.loggedIn ? "Manage in Settings" : "Use Codex CLI login"] })}${staticCard({ icon: "ph-moon-stars", name: "Kimi Coding", description: "Kimi coding subscription using the Anthropic-compatible API.", on: status.kimiCoding.loggedIn, methods: [status.kimiCoding.loggedIn ? "Manage in Settings" : "Connect in Settings"] })}</div></section>
<section><div class="mb-3"><h2 class="text-xs font-semibold uppercase tracking-wider text-base-content/55">API providers</h2><p class="mt-1 text-xs text-base-content/45">API keys remain separately managed in Settings.</p></div><div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">${staticCard({ icon: "ph-sparkle", name: "Anthropic API", description: "Claude models billed through an Anthropic API key.", on: status.anthropic.set, methods: [status.anthropic.set ? "Manage key in Settings" : "Add key in Settings"] })}${staticCard({ icon: "ph-circles-three-plus", name: "OpenAI", description: "OpenAI platform models and billing.", on: status.openai.set, methods: [status.openai.set ? "Manage key in Settings" : "Add key in Settings"] })}${staticCard({ icon: "ph-git-fork", name: "OpenRouter", description: "Multiple model vendors through one API.", on: status.openrouter.set, methods: [status.openrouter.set ? "Manage key in Settings" : "Add key in Settings"] })}</div></section>
<aside class="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-info"><strong>Credential isolation.</strong> Managed Anthropic tokens are encrypted before storage and never displayed. Existing API-key and Claude CLI authentication paths are unchanged. <a class="underline" href="/settings">Open Settings</a>.</aside>
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
