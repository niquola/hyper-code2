// One account surface grouped by provider. Credential storage is an adapter
// detail, never the information architecture of the page.
/** Renders subscription accounts consistently in provider-oriented groups. */
/**
 * Render one account list grouped by provider, independent of where each
 * credential is stored. Every provider uses the same row shape, plan/quota
 * fields and add-account action; storage ownership appears only as a secondary
 * badge and tooltip.
 *
 * @param opts.accounts Credential rows from llm.listAccounts.
 * @param opts.logins Safe progress state from llm.accountLoginStatus.
 * @param opts.now Current time in ms, for testing.
 */
export default function (ctx: Context, _session: Session | null, opts: {
    /** Rows produced by llm.listAccounts. */ accounts: Array<{ provider: string; account: string; label: string; model: string; source: "file" | "oauth" | "keychain"; available: boolean; usedPercent: number | null; planType: string | null; resetsAt: number | null; parkedAgents: number; needsReconnect?: boolean }>;
    /** Login flows currently pending or recently completed. */ logins?: Array<{ provider: string; account: string; status: "pending" | "connected" | "failed"; verificationUri: string | null; userCode: string | null; error: string | null }>;
    /** Current timestamp in ms. */ now?: number;
}): string {
    const now = opts.now ?? Date.now();
    const esc = (x: any) => ctx.fns.procs.ui.escape({ text: String(x ?? "") });
    const prefix = (a: typeof opts.accounts[number]) => `${a.provider}${a.account === "default" ? "" : `/${a.account}`}:`;

    const remove = (a: typeof opts.accounts[number]) => {
        if (a.source !== "oauth" && a.account === "default") return "";
        return ctx.fns.ui.popup({ method: "llms.removeAccount", params: { provider: a.provider, account: a.account }, tone: "danger", size: "xs", html: `<i class="ph ph-trash" aria-hidden="true"></i><span>Remove</span>` });
    };
    const row = (a: typeof opts.accounts[number]) => {
        const used = a.usedPercent;
        const quota = !a.available ? `limit exhausted${a.resetsAt ? ` · resets ${humanDelay(a.resetsAt-now)}` : ""}` : used == null ? "usage unavailable" : `${Math.round(used)}% used · ${Math.round(100-used)}% left`;
        const status = !a.available || (used != null && used >= 75) ? "limit" : used != null && used >= 50 ? "warning" : "ready";
        const storage = storageLabel(a.source);
        const reconnect = a.needsReconnect
            ? ctx.fns.ui.popup({ method: "llms.loginPopupFor", params: { provider: a.provider === "anthropic-oauth" ? "claude-code" : a.provider, account: a.account }, tone: "warning", size: "xs", html: `<i class="ph ph-arrow-clockwise" aria-hidden="true"></i><span>Reconnect</span>` })
            : "";
        const actions = `<span class="flex items-center gap-1">${reconnect}${remove(a)}</span>`;
        return ctx.fns.procs.ui.row({ entity: "llm-account", id: `${a.provider}/${a.account}`, status: a.needsReconnect ? "error" : status, cells: [
            { role: "account", text: a.account === "default" ? "main" : a.account, class: "w-28 shrink-0 font-mono text-xs font-medium" },
            ...(a.planType ? [{ role: "plan", text: planName(a.provider, a.planType), title: `Subscription plan: ${a.planType}`, class: "badge badge-sm shrink-0 capitalize text-base-content/65" }] : []),
            { role: "prefix", text: prefix(a), title: prefix(a), class: "min-w-0 flex-1 truncate font-mono text-[11px] text-base-content/40" },
            { role: "storage", text: storage.text, title: storage.title, class: "hidden shrink-0 text-[10px] text-base-content/40 lg:block" },
            { role: "quota", text: quota, class: `shrink-0 text-[11px] ${status === "limit" ? "text-error" : status === "warning" ? "text-warning" : "text-success"}` },
            ...(a.needsReconnect ? [{ role: "auth", text: "authentication required", class: "shrink-0 text-[11px] font-medium text-error" }] : []),
            ...(a.parkedAgents ? [{ role: "parked", text: `${a.parkedAgents} parked`, class: "badge badge-sm shrink-0 text-warning" }] : []),
        ], right: actions });
    };

    const providers = [
        { id: "codex", title: "Codex", icon: "codex:gpt", accounts: opts.accounts.filter(a => a.provider === "codex"), add: addButton(ctx, "codex", "Add Codex account") },
        { id: "claude", title: "Claude", icon: "claude-code:claude", accounts: opts.accounts.filter(a => a.provider === "claude-code" || a.provider === "anthropic-oauth"), add: addButton(ctx, "claude-code", "Add Claude account") },
        { id: "kimi", title: "Kimi Coding", icon: "kimi-coding:k3", accounts: opts.accounts.filter(a => a.provider === "kimi-coding"), add: ctx.fns.procs.ui.button({ action: "add-kimi", label: "+ Add account", tone: "default", size: "sm", disabled: true, title: "Kimi multi-login is not wired yet" }) },
    ];
    const providerSections = providers.map(p => {
        const title = `${ctx.fns.ui.modelLogo?.({ model: p.icon, bare: true }) ?? ""}<span>${esc(p.title)}</span>`;
        const heading = ctx.fns.procs.ui.heading({ title: p.title, meta: `${p.accounts.length} connected account${p.accounts.length === 1 ? "" : "s"}`, actions: p.add });
        return `<section data-provider="${p.id}"><div class="[&_h2]:flex [&_h2]:items-center [&_h2]:gap-2">${heading.replace(esc(p.title), title)}</div><div class="mt-2 overflow-hidden rounded-xl border border-ui-border bg-base-100">${p.accounts.length ? p.accounts.map(row).join("") : ctx.fns.procs.ui.empty({ title: `No ${p.title} accounts`, text: "Use Add account to connect one." })}</div></section>`;
    }).join("");

    const flowRows = (opts.logins ?? []).map(f => ctx.fns.procs.ui.row({ entity: "llm-login", id: `${f.provider}/${f.account}`, status: f.status, cells: [
        { role: "provider", text: providerName(f.provider), class: "w-36 shrink-0 font-medium" },
        { role: "account", text: f.account, class: "w-24 shrink-0 font-mono text-xs" },
        { role: "status", text: f.status, class: "shrink-0 text-info" },
        ...(f.userCode ? [{ role: "device-code", text: f.userCode, class: "select-all shrink-0 rounded bg-base-200 px-2 py-1 font-mono text-sm font-semibold tracking-wider" }] : []),
    ], right: ctx.fns.ui.popup({ method: "llms.loginProgressFor", params: { provider: f.provider, account: f.account }, tone: "default", size: "xs", html: "Continue login" }) })).join("");

    const html = `<div class="space-y-6">${providerSections}${flowRows ? `<section>${ctx.fns.procs.ui.heading({ title: "Logins in progress", meta: "Safe authorization status only." })}<div class="mt-2 overflow-hidden rounded-xl border border-ui-border bg-base-100">${flowRows}</div></section>` : ""}</div>`;
    return ctx.fns.ui.live({ id: "llm-accounts", url: "/llms/accounts", topic: "llm-accounts", every: 10, attrs: 'class="block"', html });
}

function addButton(ctx: Context, provider: "claude-code" | "codex", title: string): string {
    return ctx.fns.ui.popup({ method: "llms.loginPopupFor", params: { provider }, tone: "default", size: "sm", html: `<i class="ph ph-plus" aria-hidden="true"></i><span>${ctx.fns.procs.ui.escape({ text: title })}</span>` });
}
function storageLabel(source:string){return source==="oauth"?{text:"Encrypted by Hyper",title:"OAuth credential encrypted and stored by Hyper"}:source==="keychain"?{text:"Keychain",title:"Credential stored by the official CLI in macOS Keychain"}:{text:"CLI storage",title:"Credential stored in an isolated official CLI directory"};}
function providerName(p:string){return p==="anthropic-oauth"?"Claude":p==="claude-code"?"Claude Code":p==="kimi-coding"?"Kimi Coding":p==="codex"?"Codex":p;}
function planName(provider:string, plan:string){const p=String(plan).toLowerCase();if(provider==="codex"&&p==="prolite")return "ChatGPT Go";return p==="pro"?"Pro":p==="max"?"Max":p==="team"?"Team":p==="enterprise"?"Enterprise":plan;}
function humanDelay(ms:number){const m=Math.floor(Math.max(0,ms)/60000),h=Math.floor(m/60),d=Math.floor(h/24);return d?`${d}d ${h%24}h`:h?`${h}h ${m%60}m`:`${m}m`;}
