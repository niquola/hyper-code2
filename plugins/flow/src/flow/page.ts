/**
 * Renders the complete Gaps attention list with explicit revision-bound actions
 *
 * Use from the GET attention route or after an action. Escapes all declaration output, shows isolated check errors and an honest empty state; forms submit only flow and stable target identity.
 * @param opts.notice Optional action receipt status to display above the refreshed list.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Optional action receipt status to display above the refreshed list. */
        notice?: string;
    },
): Promise<string> {
    const rows=await ctx.fns.flow.list({});
    const esc=(value:string)=>Bun.escapeHTML(value);
    const count=rows.reduce((n,row)=>n+row.result.gaps.length,0);
    return '<main id="gaps-page" class="mx-auto max-w-4xl p-6"><h1 class="text-2xl font-bold">Gaps — '+count+'</h1><p>Требует внимания. Current needs computed from facts; reminders do not close a need.</p>'+(opts.notice?'<p role="status">'+esc(opts.notice)+'</p>':'')+'<a href="/gaps" hx-get="/gaps" hx-target="#gaps-page" hx-select="#gaps-page" hx-swap="outerHTML">Refresh</a>'+(count===0?'<p class="my-6">No current gaps'+(rows.some(r=>r.result.error)?' from successful checks. Some checks failed below.':'.')+'</p>':'')+(rows.length===0?'<p>No $gap_ declarations are loaded. Add a trusted rule to src/ or .hyper/ and reload plugins.</p>':'')+rows.map(row=>'<section class="my-4 rounded border p-4"><h2 class="font-semibold">'+esc(row.flow)+'</h2><p class="text-xs text-gray-500">'+esc(row.source)+'</p>'+(row.result.error?'<p role="alert">Check failed: '+esc(row.result.error)+'</p>':'')+row.result.gaps.map(gap=>'<article class="border-t py-3"><p>'+esc(gap.summary)+'</p>'+(gap.for?'<p>'+esc(gap.for)+'</p>':'')+(gap.will?'<form method="post" action="/gaps/apply" hx-post="/gaps/apply" hx-target="#gaps-page" hx-select="#gaps-page" hx-swap="outerHTML" hx-disabled-elt="find button"><input type="hidden" name="flow" value="'+esc(row.flow)+'"><input type="hidden" name="id" value="'+esc(gap.id)+'"><input type="hidden" name="revision" value="'+esc(gap.revision)+'"><button class="my-2 rounded border px-3 py-1" type="submit">'+esc(gap.will)+'</button></form>':'<p>No action available.</p>')+'</article>').join('')+'</section>').join('')+'</main>';
}
