// Account inventory in two explicit ownership groups. Shared UI primitives own
// rows, headings, buttons and toolbars; this module only supplies account data.
/** Renders grouped subscription accounts with shared UI components. */
/**
 * Render filesystem/Keychain accounts separately from credentials managed and
 * encrypted by Hyper. Uses procs.ui heading/row/button/toolbar primitives and
 * ui.popup triggers — no hand-authored button colour classes.
 *
 * @param opts.accounts Credential rows from llm.listAccounts.
 * @param opts.logins Safe progress state from llm.accountLoginStatus.
 * @param opts.now Current time in ms, for testing.
 */
export default function (ctx: Context, _session: Session | null, opts: {
    /** Rows produced by llm.listAccounts. */ accounts: Array<{ provider: string; account: string; label: string; model: string; source: "file" | "oauth" | "keychain"; available: boolean; usedPercent: number | null; resetsAt: number | null; parkedAgents: number }>;
    /** Login flows currently pending or recently completed. */ logins?: Array<{ provider: string; account: string; status: "pending" | "connected" | "failed"; verificationUri: string | null; userCode: string | null; error: string | null }>;
    /** Current timestamp in ms. */ now?: number;
}): string {
    const now = opts.now ?? Date.now();
    const esc = (x: any) => ctx.fns.procs.ui.escape({ text: String(x ?? "") });
    const providerName = (p: string) => p === "anthropic-oauth" ? "Claude" : p === "claude-code" ? "Claude Code" : p === "kimi-coding" ? "Kimi Coding" : p === "codex" ? "Codex" : p;
    const prefix = (a: typeof opts.accounts[number]) => `${a.provider}${a.account === "default" ? "" : `/${a.account}`}:`;

    const remove = (a: typeof opts.accounts[number]) => {
        if (a.source !== "oauth" && a.account === "default") return "";
        return ctx.fns.ui.popup({ method: "llms.removeAccount", params: { provider: a.provider, account: a.account }, tone: "danger", size: "xs", html: `<i class="ph ph-trash" aria-hidden="true"></i><span>Remove</span>` });
    };
    const row = (a: typeof opts.accounts[number]) => {
        const used = a.usedPercent;
        const quota = !a.available ? `limit exhausted${a.resetsAt ? ` · resets ${humanDelay(a.resetsAt-now)}` : ""}` : used == null ? "usage unavailable" : `${Math.round(used)}% used · ${Math.round(100-used)}% left`;
        const status = !a.available || (used != null && used >= 75) ? "limit" : used != null && used >= 50 ? "warning" : "ready";
        return ctx.fns.procs.ui.row({ entity: "llm-account", id: `${a.provider}/${a.account}`, status, cells: [
            { role: "provider", html: `${ctx.fns.ui.modelLogo?.({ model: a.model || `${a.provider}:`, bare: true }) ?? ""}<span class="ml-2 font-medium">${esc(providerName(a.provider))}</span>`, class: "flex w-40 shrink-0 items-center" },
            { role: "account", text: a.account === "default" ? "main" : a.account, class: "w-24 shrink-0 font-mono text-xs text-base-content/55" },
            { role: "prefix", text: prefix(a), title: prefix(a), class: "min-w-0 flex-1 truncate font-mono text-[11px] text-base-content/40" },
            { role: "quota", text: quota, class: `shrink-0 text-[11px] ${status === "limit" ? "text-error" : status === "warning" ? "text-warning" : "text-success"}` },
            ...(a.parkedAgents ? [{ role: "parked", text: `${a.parkedAgents} parked`, class: "badge badge-sm shrink-0 text-warning" }] : []),
        ], right: remove(a) });
    };
    const group = (title: string, meta: string, accounts: typeof opts.accounts) => {
        const heading = ctx.fns.procs.ui.heading({ title, meta });
        return `<section>${heading}<div class="mt-2 overflow-hidden rounded-xl border border-ui-border bg-base-100">${accounts.length ? accounts.map(row).join("") : ctx.fns.procs.ui.empty({ title: "No accounts", text: meta })}</div></section>`;
    };

    const external = (opts.accounts ?? []).filter(a => a.source !== "oauth");
    const managed = (opts.accounts ?? []).filter(a => a.source === "oauth");
    const flowRows = (opts.logins ?? []).map(f => ctx.fns.procs.ui.row({ entity: "llm-login", id: `${f.provider}/${f.account}`, status: f.status, cells: [
        { role: "provider", text: providerName(f.provider), class: "w-36 shrink-0 font-medium" },
        { role: "account", text: f.account, class: "w-24 shrink-0 font-mono text-xs" },
        { role: "status", text: f.status, class: "shrink-0 text-info" },
        ...(f.userCode ? [{ role: "device-code", text: f.userCode, class: "select-all shrink-0 rounded bg-base-200 px-2 py-1 font-mono text-sm font-semibold tracking-wider" }] : []),
    ], right: ctx.fns.ui.popup({ method: "llms.loginProgressFor", params: { provider: f.provider, account: f.account }, tone: "default", size: "xs", html: "Continue login" }) })).join("");

    const addClaude = ctx.fns.ui.popup({ method: "llms.loginPopupFor", params: { provider: "claude-code" }, tone: "default", html: `<i class="ph ph-plus"></i> Claude` });
    const addCodex = ctx.fns.ui.popup({ method: "llms.loginPopupFor", params: { provider: "codex" }, tone: "default", html: `<i class="ph ph-plus"></i> Codex` });
    const addKimi = ctx.fns.procs.ui.button({ action: "add-kimi", label: "+ Kimi", tone: "default", disabled: true, title: "Kimi multi-login is not wired yet" });
    const toolbar = ctx.fns.procs.ui.toolbar({ left: `<span class="text-xs text-base-content/50">Add account</span>`, right: `${addClaude}${addCodex}${addKimi}` });

    const html = `<div class="space-y-6">${group("Accounts from filesystem & Keychain", "Owned by the official CLI; Hyper never stores these tokens.", external)}<div class="border-t border-ui-border"></div>${group("Managed by Hyper", "OAuth tokens encrypted in Postgres; removable from this page.", managed)}${flowRows ? `<section>${ctx.fns.procs.ui.heading({ title: "Logins in progress", meta: "Safe authorization status only." })}<div class="mt-2 overflow-hidden rounded-xl border border-ui-border bg-base-100">${flowRows}</div></section>` : ""}<div class="rounded-xl border border-ui-border bg-base-200 p-3">${toolbar}</div></div>`;
    return ctx.fns.ui.live({ id: "llm-accounts", url: "/llms/accounts", topic: "llm-accounts", every: 10, attrs: 'class="block"', html });
}
function humanDelay(ms:number){const m=Math.floor(Math.max(0,ms)/60000),h=Math.floor(m/60),d=Math.floor(h/24);return d?`${d}d ${h%24}h`:h?`${h}h ${m%60}m`:`${m}m`;}
