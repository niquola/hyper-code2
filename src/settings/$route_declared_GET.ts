export default async function (ctx: Context, _session: Session | null, _opts: { req: Request; params: Record<string, string> }) {
    const items = ctx.fns.settings.declared({});
    const main = `
<header class="px-6 py-3 border-b border-gray-200 flex items-center gap-3 text-sm">
  <span class="font-semibold text-gray-700">declared settings</span>
  <span class="text-xs text-gray-400">${items.length} declared</span>
</header>
${ctx.fns.settings.renderDeclaredForm({})}`;
    return { title: 'settings', main };
}
