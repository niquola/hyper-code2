import { stat } from "node:fs/promises";
import { basename, extname } from "node:path";

// GET /files?path=... — directory listing OR file view (Preview/Code/Edit).
export default async function (ctx: Context, _session: any, req: any) {
    const url = new URL(req.url);
    const path = url.searchParams.get("path") ?? "";
    const tab = url.searchParams.get("tab") ?? "";
    const abs = ctx.fns.files.resolveSafe(ctx, { path });
    const st = await stat(abs).catch(() => null);
    if (!st) {
        return {
            status: 404,
            title: path || "files",
            main: page(`<div class="p-6 text-red-700">not found: <code>${esc(path)}</code></div>`),
        };
    }

    if (st.isDirectory()) return renderDir(ctx, path);

    // User is already navigating here — add to tabs but don't broadcast
    // (self-echo would cancel the in-flight nav and re-trigger it).
    ctx.fns.files.open(ctx, { path, broadcast: false });
    return renderFile(ctx, path, tab);
}

async function renderDir(ctx: Context, path: string) {
    const entries = await ctx.fns.files.list(ctx, { path });
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
    return { title: path || "files", main: page(body) };
}

async function renderFile(ctx: Context, path: string, tabParam: string) {
    const content = await ctx.fns.files.read(ctx, { path });
    const name = basename(path);
    const ext = extname(name).slice(1).toLowerCase();
    const isMd = ext === "md" || ext === "markdown";
    const isHtml = ext === "html" || ext === "htm";
    const tab = tabParam || (isMd ? "preview" : "code");
    const shikiLang = SHIKI_EXT[ext] ?? "text";
    const cmLang = CM_EXT[ext] ?? null;

    const tabCls = (id: string) => id === tab
        ? "px-2.5 py-0.5 text-xs font-medium text-gray-900 bg-white border border-gray-300 rounded"
        : "px-2.5 py-0.5 text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded cursor-pointer";
    const tabLink = (id: string, label: string) =>
        `<a href="/files?path=${encodeURIComponent(path)}&tab=${id}" class="${tabCls(id)}">${label}</a>`;

    const tabs: string[] = [];
    if (isMd) tabs.push(tabLink("preview", "Preview"));
    if (isHtml) tabs.push(tabLink("preview", "Preview"));
    tabs.push(tabLink("code", "Code"));
    tabs.push(tabLink("edit", "Edit"));

    let contentEl = "";
    let headExtra = "";
    if (tab === "preview" && isMd) {
        const html = await ctx.fns.markdown.render(ctx, { source: content });
        contentEl = `<div class="flex-1 overflow-auto p-6"><div class="prose prose-sm max-w-none">${html}</div></div>`;
    } else if (tab === "preview" && isHtml) {
        contentEl = `<iframe srcdoc="${esc(content)}" class="flex-1 w-full border-0" sandbox="allow-scripts"></iframe>`;
    } else if (tab === "edit") {
        headExtra = `<script>window.__editor = ${JSON.stringify({
            saveUrl: `/files?path=${encodeURIComponent(path)}`,
            content,
            lang: cmLang,
        })};</script>
<script src="/files/editor.js" defer></script>`;
        contentEl = `<div id="cm-editor" class="flex-1 overflow-hidden"></div>`;
    } else {
        const html = await ctx.fns.markdown.highlight(ctx, { code: content, lang: shikiLang });
        contentEl = `<div class="flex-1 overflow-auto text-xs bg-white [&_pre]:m-0 [&_pre]:rounded-none [&_pre]:p-4">${html}</div>`;
    }

    const crumbs = breadcrumbs(path);
    const body = `
<div class="border-b border-gray-200 bg-gray-50 shrink-0 px-4 py-1.5 flex items-center gap-2">
  <span class="text-xs font-mono text-gray-700 truncate mr-2">${esc(path)}</span>
  ${tabs.join("")}
  <span id="save-status" class="text-xs hidden"></span>
  ${tab === "edit" ? `<label class="flex items-center gap-1 text-xs text-gray-500 cursor-pointer ml-2"><input type="checkbox" id="vim-toggle" class="w-3 h-3">vim</label>` : ""}
  <span class="flex-1"></span>
  <span class="text-xs text-gray-400 shrink-0">${content.length} chars · ${content.split("\n").length} lines</span>
</div>
${tab === "edit" ? `<div id="vim-status" class="hidden bg-gray-800 text-gray-100 text-xs px-3 py-0.5 font-mono shrink-0"></div>` : ""}
<div class="px-4 py-2 border-b border-gray-200 text-xs">${crumbs}</div>
${contentEl}`;

    return { title: path, main: page(body), headExtra };
}

function page(body: string): string {
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

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

const SHIKI_EXT: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", mjs: "javascript",
    json: "json", md: "markdown", html: "html", css: "css", sql: "sql",
    py: "python", rs: "rust", go: "go", java: "java", yaml: "yaml", yml: "yaml",
    toml: "toml", sh: "bash", bash: "bash", zsh: "bash", xml: "xml", diff: "diff",
};
const CM_EXT: Record<string, string> = {
    ts: "javascript", tsx: "javascript", js: "javascript", jsx: "javascript", mjs: "javascript",
    json: "json", md: "markdown", html: "html", css: "css", sql: "sql",
    py: "python", rs: "rust", go: "go", java: "java", yaml: "yaml", yml: "yaml",
    xml: "xml",
};
