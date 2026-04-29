export default async function (ctx: Context, _session: any, _req: Request) {
    const store: Record<string, any> = (ctx.state as any).agent ?? {};
    const ids = Object.keys(store);
    if (ids.length > 0) {
        return new Response(null, { status: 302, headers: { location: `/agent/${encodeURIComponent(ids[0]!)}` } });
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
