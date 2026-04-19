import { stat } from "node:fs/promises";

// GET /files?path=... — directory listing OR file view/edit page (same route).
export default async function (ctx: Context, _session: any, req: any) {
    const url = new URL(req.url);
    const path = url.searchParams.get("path") ?? "";
    const abs = ctx.fns.files.resolveSafe(ctx, path);
    const st = await stat(abs).catch(() => null);
    if (!st) {
        const main = page(ctx, path, `<div class="p-6 text-red-700">not found: <code>${esc(path)}</code></div>`);
        return new Response(ctx.fns.ui.layout(ctx, { title: path || "files", main }), { status: 404, headers: htmlHeaders() });
    }

    if (st.isDirectory()) return renderDir(ctx, path);
    return renderFile(ctx, path);
}

async function renderDir(ctx: Context, path: string) {
    const entries = await ctx.fns.files.list(ctx, path);
    const crumbs = breadcrumbs(path);
    const rows = entries.map(e => {
        const full = path ? `${path}/${e.name}` : e.name;
        const icon = e.isDir ? "📁" : "📄";
        return `<a href="/files?path=${encodeURIComponent(full)}" class="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 border-b border-gray-100 text-sm">
<span>${icon}</span><span class="font-mono text-gray-700">${esc(e.name)}${e.isDir ? "/" : ""}</span>
</a>`;
    }).join("");
    const body = `
<div class="px-6 py-4 border-b border-gray-200 text-sm">${crumbs}</div>
<div class="flex-1 overflow-y-auto">${rows || '<div class="p-6 text-gray-400">(empty)</div>'}</div>`;
    return new Response(ctx.fns.ui.layout(ctx, { title: path || "files", main: page(ctx, path, body) }), { status: 200, headers: htmlHeaders() });
}

async function renderFile(ctx: Context, path: string) {
    const content = await ctx.fns.files.read(ctx, path);
    const crumbs = breadcrumbs(path);
    const body = `
<div class="px-6 py-3 border-b border-gray-200 text-sm flex items-center gap-3">
  <span>${crumbs}</span>
  <span class="text-xs text-gray-400 ml-auto">${content.length} chars · ${content.split("\n").length} lines</span>
</div>
<form method="POST" action="/files?path=${encodeURIComponent(path)}" class="flex-1 flex flex-col overflow-hidden">
  <textarea name="content" spellcheck="false" class="flex-1 p-4 font-mono text-xs leading-relaxed resize-none outline-none border-0">${esc(content)}</textarea>
  <div class="flex items-center gap-2 px-6 py-3 border-t border-gray-200 bg-gray-50">
    <button type="submit" class="px-4 py-1.5 bg-gray-900 text-white rounded text-sm hover:bg-gray-700">Save</button>
    <a href="/files?path=${encodeURIComponent(parentOf(path))}" class="px-4 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-100">Cancel</a>
  </div>
</form>`;
    return new Response(ctx.fns.ui.layout(ctx, { title: path, main: page(ctx, path, body) }), { status: 200, headers: htmlHeaders() });
}

function page(_ctx: Context, _path: string, body: string): string {
    return `<div class="flex-1 flex flex-col overflow-hidden">${body}</div>`;
}

function breadcrumbs(path: string): string {
    const parts = path ? path.split("/") : [];
    const links = [`<a href="/files" class="text-blue-600 hover:underline">workspace</a>`];
    for (let i = 0; i < parts.length; i++) {
        const sub = parts.slice(0, i + 1).join("/");
        links.push(`<a href="/files?path=${encodeURIComponent(sub)}" class="text-blue-600 hover:underline">${esc(parts[i]!)}</a>`);
    }
    return links.join(` <span class="text-gray-400">/</span> `);
}

function parentOf(path: string): string {
    const i = path.lastIndexOf("/");
    return i >= 0 ? path.slice(0, i) : "";
}

function htmlHeaders() {
    return { "content-type": "text/html; charset=utf-8" };
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
