// Render the active secure-input modal as an HTMX fragment. Dynamic text is
// escaped; the secret itself only travels in the subsequent form POST.
export default function (ctx: Context, _session: Session | null, opts: { prompt: any; error?: string }): string {
    const p = opts.prompt;
    const esc = (v: unknown) => ctx.fns.procs.ui.escape({ text: String(v ?? '') });
    const action = `/secureInput/prompt/${encodeURIComponent(p.id)}`;
    const type = p.kind === 'password' ? 'password' : 'text';
    const otp = p.kind === 'otp';
    return `<div id="secret-prompt-overlay" data-prompt-id="${esc(p.id)}" class="fixed inset-0 z-[1300] flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-[1px]">
  <section class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
    <h2 class="text-base font-semibold text-gray-900">${esc(p.title)}</h2>
    <p class="mt-1 text-sm text-gray-500">${esc(p.message)}</p>
    <p class="mt-1 font-mono text-[10px] text-gray-400">${esc(p.name)}</p>
    <form class="mt-4 space-y-4" hx-post="${action}" hx-target="#secure-input-host" hx-swap="innerHTML">
      <input name="value" type="${type}" required maxlength="${Number(p.maxlength ?? 256)}" ${otp ? 'inputmode="numeric" autocomplete="one-time-code" placeholder="12345"' : type === 'password' ? 'autocomplete="current-password"' : ''} class="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 ${otp ? 'font-mono tracking-[0.3em]' : ''}" autofocus>
      <div class="flex justify-end gap-2">
        <button type="button" name="cancel" value="1" hx-post="${action}" hx-vals='{"cancel":"1"}' hx-target="#secure-input-host" hx-swap="innerHTML" class="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-200 focus:outline-none focus:ring-4 focus:ring-gray-200">Cancel</button>
        <button type="submit" class="inline-flex items-center justify-center rounded-xl border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:border-blue-700 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50">Submit</button>
      </div>
      <p id="secure-input-error" class="text-sm text-red-600">${esc(opts.error)}</p>
    </form>
  </section>
</div>`;
}
