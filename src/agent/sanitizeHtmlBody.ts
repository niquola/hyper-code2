// Sanitize an §html body before injecting it into the chat DOM. Models
// (notably Haiku) sometimes emit a full <!DOCTYPE> document. We strip:
//   1. block-level elements with content — <head>, <title>, <style>,
//      <script>, <noscript> — including everything between open and close
//   2. wrapper-only tags — <html>, <body>, <meta>, <link> — leaving inner
//      content intact (rare; usually empty)
//   3. <!DOCTYPE …> declaration
// Result is collapsed of leading/trailing whitespace. Tailwind utility
// classes inline still work because they're already loaded by $layout.ts.
export default function (_ctx: Context, opts: { html: string }): string {
    let s = opts.html;
    s = s.replace(/<!doctype[^>]*>/gi, '');
    // Strip block elements WITH content first (open through close).
    s = s.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
    s = s.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '');
    s = s.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    s = s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    s = s.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
    // Then strip remaining wrapper tags (open and close, no content stripping).
    s = s.replace(/<\/?(?:html|body|meta|link)[^>]*>/gi, '');
    return s.trim();
}
