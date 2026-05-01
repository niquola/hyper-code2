export default async function (ctx: Context) {
    const items = ctx.fns.settings.declared(ctx);
    const main = `
<header class="px-6 py-3 border-b border-gray-200 flex items-center gap-3 text-sm">
  <span class="font-semibold text-gray-700">declared settings</span>
  <span class="text-xs text-gray-400">${items.length} declared</span>
</header>
${ctx.fns.settings.renderDeclaredForm(ctx)}`;
    return { title: 'settings', main };
}
