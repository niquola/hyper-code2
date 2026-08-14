export default function (
    ctx: Context,
    _session: Session | null,
    opts: { name: string; enabled: boolean; label?: string; hint?: string; compact?: boolean; title?: string },
): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const text = opts.label ? `<span class="min-w-0 flex-1"><span class="block ${opts.compact ? 'text-[11px] font-medium' : 'text-sm'} ${opts.enabled ? 'text-gray-700' : 'text-gray-500'}">${esc(opts.label)}</span>${opts.hint ? `<span class="block text-[10px] leading-4 text-gray-400">${esc(opts.hint)}</span>` : ''}</span>` : '';
    const track = opts.enabled ? 'background:rgb(99 102 241)' : 'background:rgb(229 231 235)';
    const thumb = opts.enabled ? 'left:22px' : 'left:2px';
    return `<label class="flex cursor-pointer items-center gap-3"${opts.title ? ` title="${esc(opts.title)}"` : ''}>${text}<input name="${esc(opts.name)}" type="checkbox" value="1" ${opts.enabled ? 'checked' : ''} class="ui-toggle-input sr-only" onchange="this.nextElementSibling.style.background=this.checked?'rgb(99 102 241)':'rgb(229 231 235)';this.nextElementSibling.firstElementChild.style.left=this.checked?'22px':'2px'"><span class="ui-toggle-track" style="${track}" aria-hidden="true"><span class="ui-toggle-thumb" style="${thumb}"></span></span></label>`;
}
