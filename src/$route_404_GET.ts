export default async function (ctx: Context, _session: any, _req: Request) {
    return {
        title: "404",
        main: `<div class="flex-1 flex items-center justify-center">
  <div class="text-center">
    <div class="text-6xl font-semibold tracking-tight text-gray-300">404</div>
    <div class="mt-3 text-sm text-gray-500">Page not found</div>
    <div class="mt-6">
      <a href="/" class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
        Go home
      </a>
    </div>
  </div>
</div>`,
        status: 404,
    };
}