/**
 * Renders the live cron jobs management panel.
 *
 * Builds the HTML fragment used by the cron page and htmx refresh/actions, including status, schedule metadata, errors, and controls.
 * @param opts.message Optional success message to display.
 * @param opts.error Optional operation error to display.
 * @param opts.limit Maximum recent occurrences rendered. @default 100 @minimum 1 @maximum 500
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Optional success message to display. */
        message?: string;
        /** Optional operation error to display. */
        error?: string;
        /** Maximum recent occurrences rendered. @default 100 @minimum 1 @maximum 500 */
        limit?: number;
    },
): Promise<string> {
    const esc = (value: any) => ctx.fns.procs.ui.escape({ text: String(value ?? "") });
    const jobs = await ctx.fns.cron.list({ limit: Math.max(1, Math.min(500, opts.limit ?? 100)) });
    const time = (value: any) => value == null ? "—" : new Date(Number(value)).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium" });
    const interval = (value: any) => { let ms = Number(value ?? 0); if (!ms) return "once"; const parts: string[] = []; for (const [unit, size] of [["d",86400000],["h",3600000],["m",60000],["s",1000]] as const) { const n = Math.floor(ms / size); if (n) { parts.push(`${n}${unit}`); ms -= n * size; } } return parts.join("") || "<1s"; };
    const badge = (status: string) => ({ pending: "bg-info/10 text-info ring-info/25", running: "bg-warning/10 text-warning ring-warning/25", done: "bg-success/10 text-success ring-success/25", error: "bg-error/10 text-error ring-error/25" } as any)[status] ?? "bg-base-200 text-base-content/60 ring-base-300";
    const rows = jobs.map((job: any) => { const args = JSON.stringify(job.args ?? {}); const detail = job.error ? `<div class="mt-1 max-w-xl truncate text-xs text-error" title="${esc(job.error)}">${esc(String(job.error).split("\n")[0])}</div>` : ""; return `<tr class="border-t border-base-200 align-top">
    <td class="px-3 py-3"><div class="font-medium text-base-content">${esc(job.name)}</div><div class="mt-1 font-mono text-[11px] text-base-content/45">#${esc(job.id)}</div></td>
    <td class="px-3 py-3"><code class="text-xs text-primary">${esc(job.fn)}</code><div class="mt-1 max-w-72 truncate font-mono text-[11px] text-base-content/45" title="${esc(args)}">${esc(args)}</div>${detail}</td>
    <td class="px-3 py-3"><span class="inline-flex rounded-full px-2 py-1 text-[11px] font-medium ring-1 ring-inset ${badge(job.status)}">${esc(job.status)}</span></td>
    <td class="px-3 py-3 text-xs text-base-content/65"><div>${esc(time(job.runAt))}</div><div class="mt-1 text-[11px] text-base-content/45">${esc(interval(job.everyMs))}</div></td>
    <td class="px-3 py-3"><div class="flex flex-wrap gap-2">${job.status === "pending" ? `<form hx-post="/cron/run-now" hx-target="#cron-jobs" hx-swap="outerHTML"><input type="hidden" name="name" value="${esc(job.name)}"><button class="rounded-md border border-base-300 bg-base-100 px-2.5 py-1.5 text-xs hover:bg-base-200">Run now</button></form><form hx-post="/cron/remove" hx-target="#cron-jobs" hx-swap="outerHTML" hx-confirm="Cancel pending occurrences of ${esc(job.name)}?"><input type="hidden" name="name" value="${esc(job.name)}"><button class="rounded-md border border-error/25 px-2.5 py-1.5 text-xs text-error hover:bg-error/10">Remove</button></form>` : ""}</div></td></tr>`; }).join("");
    return `<section id="cron-jobs" hx-get="/cron/jobs" hx-trigger="every 5s" hx-swap="outerHTML" class="rounded-xl border border-base-300 bg-base-100 shadow-sm">
    ${opts.message ? `<div class="border-b border-success/20 bg-success/10 px-4 py-3 text-sm text-success">${esc(opts.message)}</div>` : ""}
    ${opts.error ? `<div class="border-b border-error/20 bg-error/10 px-4 py-3 text-sm text-error">${esc(opts.error)}</div>` : ""}
    <div class="overflow-x-auto"><table class="w-full min-w-[850px] text-left"><thead class="bg-base-200/60 text-[11px] uppercase tracking-wide text-base-content/45"><tr><th class="px-3 py-2">Name</th><th class="px-3 py-2">Function / args</th><th class="px-3 py-2">Status</th><th class="px-3 py-2">Run at / interval</th><th class="px-3 py-2">Actions</th></tr></thead><tbody>${rows || `<tr><td colspan="5" class="px-4 py-10 text-center text-sm text-base-content/45">No cron jobs yet.</td></tr>`}</tbody></table></div></section>`;
}
