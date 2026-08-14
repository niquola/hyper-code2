export default function (
    ctx: Context,
    _session: Session | null,
    opts: { name: string; enabled: boolean; label?: string; hint?: string; compact?: boolean; title?: string },
): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const text = opts.label ? `<span class="min-w-0 flex-1"><span class="block ${opts.compact ? 'text-[11px] font-medium' : 'text-sm'} ${opts.enabled ? 'text-gray-700' : 'text-gray-500'}">${esc(opts.label)}</span>${opts.hint ? `<span class="block text-[10px] leading-4 text-gray-400">${esc(opts.hint)}</span>` : ''}</span>` : '';
    return `<label class="flex cursor-pointer items-center gap-3"${opts.title ? ` title="${esc(opts.title)}"` : ''}>${text}<input name="${esc(opts.name)}" type="checkbox" value="1" ${opts.enabled ? 'checked' : ''} class="peer sr-only"><span class="relative h-5 w-9 shrink-0 overflow-hidden rounded-full bg-gray-200 transition-colors peer-checked:bg-indigo-500 peer-focus:ring-2 peer-focus:ring-indigo-200 after:absolute after:left-0.5 after:top-0.5 after:block after:size-4 after:rounded-full after:bg-white after:shadow-sm after:content-[''] after:transition-transform peer-checked:after:translate-x-4"></span></label>`;
}
