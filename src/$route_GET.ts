export default async function (ctx: Context, _session: Session | null, _opts: { req: Request; params: Record<string, string> }) {
    // DB-first: the store is the source of truth (an agent inserted after boot
    // is real even if nothing rehydrated it into ctx.state yet).
    const latest = (await ctx.fns.session.list({}))[0];
    if (latest) {
        return new Response(null, { status: 302, headers: { location: `/agent/${encodeURIComponent(latest.id)}` } });
    }
    return {
        head: '<script src="/ui/control.js"></script>',
        main: `<div class="flex-1 flex items-center justify-center text-gray-500">
  <div class="text-center">
    <p class="mb-4">No agents yet.</p>
    <a href="/agent/new" class="inline-block px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-700">+ new agent</a>
  </div>
</div>`,
    };
}
