// Render secure input into the permanent application popup. Dynamic text is
// escaped; the secret itself only travels in the subsequent form POST.
/**
 * Renders the secure-input popup for an active prompt.
 * @param opts.prompt Prompt metadata to render.
 * @param opts.error Optional validation error.
 */
export default function (ctx: Context, _session: Session | null, opts: { prompt: any; error?: string }): string {
    const p = opts.prompt;
    const esc = (v: unknown) => ctx.fns.procs.ui.escape({ text: String(v ?? '') });
    const type = p.kind === 'password' ? 'password' : 'text';
    const otp = p.kind === 'otp';
    const form = `<form hx-popup="secureInput.submit" title="${esc(p.title)}" class="mt-4 space-y-4">
      <input type="hidden" name="id" value="${esc(p.id)}">
      <input name="value" type="${type}" required maxlength="${Number(p.maxlength ?? 256)}" ${otp ? 'inputmode="numeric" autocomplete="one-time-code" placeholder="12345"' : type === 'password' ? 'autocomplete="current-password"' : ''} class="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 ${otp ? 'font-mono tracking-[0.3em]' : ''}" autofocus>
      <div class="flex justify-end gap-2">
        <button type="button" data-secure-cancel hx-popup="secureInput.submit" hx-popup-params='{"id":"${esc(p.id)}","cancel":"1"}' title="Cancel ${esc(p.title)}" class="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-200 focus:outline-none focus:ring-4 focus:ring-gray-200">Cancel</button>
        <button type="submit" class="inline-flex items-center justify-center rounded-xl border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:border-blue-700 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200">Submit</button>
      </div><p id="secure-input-error" class="text-sm text-red-600">${esc(opts.error)}</p></form>`;
    return ctx.fns.ui.popupContent({ title: p.title, kind: 'secure-input', class: 'mx-auto w-full max-w-md', html: `<p class="text-sm text-gray-500">${esc(p.message)}</p><p class="mt-1 font-mono text-[10px] text-gray-400">${esc(p.name)}</p>${form}` });
}
