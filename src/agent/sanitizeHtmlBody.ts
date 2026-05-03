// Sanitize an §html body before injecting it into the chat DOM. Models
// (notably Haiku) sometimes emit a full <!DOCTYPE> document with a <style>
// block that resets `body { margin: 40px auto }` — which then applies
// GLOBALLY to the chat page. Strip document-level wrappers and any <style>
// or <script> blocks; keep the actual content. Tailwind utility classes
// inline still work because they're already loaded by $layout.ts.
export default function (html: string): string {
    let s = html;
    s = s.replace(/<!doctype[^>]*>/gi, '');
    s = s.replace(/<\/?(?:html|head|body|meta|title|link)[^>]*>/gi, '');
    s = s.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    s = s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    return s.trim();
}
