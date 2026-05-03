import { createHighlighter, type Highlighter } from "shiki";

const LANGS = [
    "javascript", "typescript", "tsx", "jsx", "json", "css", "html",
    "sql", "python", "markdown", "xml", "rust", "java", "go",
    "yaml", "bash", "shell", "dockerfile", "toml", "diff",
] as const;

const ALIASES: Record<string, string> = {
    js: "javascript", ts: "typescript", sh: "bash", zsh: "bash",
    yml: "yaml", py: "python", txt: "text", plain: "text",
};

let _hl: Highlighter | null = null;

export async function getHL(): Promise<Highlighter> {
    if (!_hl) _hl = await createHighlighter({ themes: ["github-light"], langs: [...LANGS] });
    return _hl;
}

export default async function (_ctx: Context, opts: { code: string; lang: string }): Promise<string> {
    const safeCode = String(opts.code ?? "");
    const safeLang = String(opts.lang ?? "text");
    const hl = await getHL();
    const normalized = ALIASES[safeLang.toLowerCase()] ?? safeLang.toLowerCase();
    if (hl.getLoadedLanguages().includes(normalized as any)) {
        try { return hl.codeToHtml(safeCode, { lang: normalized, theme: "github-light" }); } catch { /* fall through */ }
    }
    return "<pre><code>" + safeCode.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</code></pre>";
}
