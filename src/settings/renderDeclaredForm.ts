// Pure-render helper for the declared-settings htmx form.
// Used by both GET (full page) and POST (re-render after save).
function esc(s: any): string {
    return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
}

function renderInput(item: any): string {
    const d = item.descriptor;
    const cur = item.currentValue;
    const name = `${item.module}.${item.key}`;
    const isSecret = d.type === 'secret';
    if (d.type === 'enum' && Array.isArray(d.options)) {
        const opts = d.options.map((o: any) => `<option value="${esc(o)}"${o === cur ? ' selected' : ''}>${esc(o)}</option>`).join('');
        return `<select name="${esc(name)}" class="px-2 py-1 border border-gray-300 rounded text-xs font-mono">${opts}</select>`;
    }
    if (d.type === 'boolean') {
        return `<input type="checkbox" name="${esc(name)}" value="true"${cur ? ' checked' : ''} class="align-middle">`;
    }
    if (d.type === 'number') {
        const min = d.min != null ? ` min="${esc(d.min)}"` : '';
        const max = d.max != null ? ` max="${esc(d.max)}"` : '';
        return `<input type="number"${min}${max} name="${esc(name)}" value="${esc(cur ?? '')}" class="px-2 py-1 border border-gray-300 rounded text-xs font-mono w-32">`;
    }
    if (d.type === 'text') {
        return `<textarea name="${esc(name)}" rows="3" class="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono">${esc(cur ?? '')}</textarea>`;
    }
    const display = isSecret && cur ? '••••••••' + String(cur).slice(-4) : (cur ?? '');
    const placeholder = isSecret ? `placeholder="${esc(display)}"` : '';
    const value = isSecret ? '' : `value="${esc(cur ?? '')}"`;
    return `<input type="${isSecret ? 'password' : 'text'}" name="${esc(name)}" ${value} ${placeholder} class="px-2 py-1 border border-gray-300 rounded text-xs font-mono w-72">`;
}

function renderRow(item: any): string {
    const d = item.descriptor;
    const sourceBadge = item.source === 'db' ? '<span class="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">db</span>'
        : item.source === 'env' ? `<span class="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">env: ${esc(d.env)}</span>`
        : '<span class="text-xs px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-200">default</span>';
    const resetBtn = item.source === 'db'
        ? `<button type="submit" name="reset" value="${esc(item.module + '.' + item.key)}" class="text-xs px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-50">reset</button>`
        : '';
    return `<tr class="border-b border-gray-100">
  <td class="px-3 py-2 align-top">
    <div class="font-mono text-xs text-gray-700">${esc(item.key)}</div>
    ${d.title ? `<div class="text-xs text-gray-500">${esc(d.title)}</div>` : ''}
    ${d.description ? `<div class="text-[11px] text-gray-400 mt-0.5">${esc(d.description)}</div>` : ''}
  </td>
  <td class="px-3 py-2 align-top">${renderInput(item)}</td>
  <td class="px-3 py-2 align-top">${sourceBadge}</td>
  <td class="px-3 py-2 align-top text-xs text-gray-400 font-mono">${esc(JSON.stringify(d.default))}</td>
  <td class="px-3 py-2 align-top">${resetBtn}</td>
</tr>`;
}

export default function (ctx: Context): string {
    const items = ctx.fns.settings.declared(ctx);
    const byModule = new Map<string, any[]>();
    for (const it of items) {
        if (!byModule.has(it.module)) byModule.set(it.module, []);
        byModule.get(it.module)!.push(it);
    }
    const sections = [...byModule.entries()].map(([mod, rows]) => `
<section class="mb-6">
  <h2 class="text-sm font-semibold text-gray-700 mb-2">${esc(mod)}</h2>
  <table class="w-full text-sm border border-gray-200 rounded">
    <thead class="bg-gray-50 text-xs text-gray-500">
      <tr><th class="text-left px-3 py-2">key</th><th class="text-left px-3 py-2">value</th><th class="text-left px-3 py-2">source</th><th class="text-left px-3 py-2">default</th><th></th></tr>
    </thead>
    <tbody>
      ${rows.map(renderRow).join('\n')}
    </tbody>
  </table>
</section>`).join('\n');

    return `<form id="settings-form"
      class="px-6 py-4 max-w-4xl"
      hx-post="/settings/declared"
      hx-target="this"
      hx-swap="outerHTML">
  ${sections || '<div class="text-sm text-gray-500">No <code>$setting_*.ts</code> declarations found.</div>'}
  ${items.length ? '<button type="submit" class="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50">Save changes</button>' : ''}
</form>`;
}
