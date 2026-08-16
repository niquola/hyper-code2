/** Handles the new get HTTP route.  * @param opts.req Incoming HTTP request.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Incoming HTTP request. */
req: Request }) {
    const fields = await ctx.fns.agent.newForm({});
    if (new URL(opts.req.url).searchParams.get('popup')) return new Response(ctx.fns.ui.popupContent({ title: 'New agent', kind: 'new-agent', html: `<form hx-popup="agent.createFromPopup" title="New agent" class="space-y-3" data-form="new-agent">${fields}<div class="flex gap-3">${ctx.fns.procs.ui.button({ action: 'create-agent', label: 'create', type: 'submit', tone: 'primary' })}${ctx.fns.procs.ui.button({ action: 'cancel-new-agent', label: 'cancel', tone: 'ghost', class: 'ml-auto', attrs: { onclick: 'window.hyperPopup?.close()' } })}</div></form>` }), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    return { title: 'new agent', main: `<div class="flex-1 overflow-y-auto"><form method="POST" action="/agent/new" hx-boost="false" class="mx-auto max-w-2xl space-y-4 px-6 py-8"><h1 class="text-xl font-semibold">New agent</h1>${fields}<div class="flex gap-3">${ctx.fns.procs.ui.button({ action: 'create-agent', label: 'create agent', type: 'submit', tone: 'primary' })}${ctx.fns.procs.ui.button({ action: 'cancel-new-agent', label: 'cancel', href: '/', tone: 'ghost' })}</div></form></div>` };
}
