import { describe, test, expect } from 'bun:test';
import sanitizeHtmlBodyFn from './sanitizeHtmlBody';
const sanitizeHtmlBody = (html: string) => sanitizeHtmlBodyFn(null as any, { html });

describe('agent.sanitizeHtmlBody', () => {
    test('plain markup passes through unchanged', () => {
        expect(sanitizeHtmlBody('<div class="p-2">hi</div>')).toBe('<div class="p-2">hi</div>');
    });

    test('strips DOCTYPE', () => {
        expect(sanitizeHtmlBody('<!DOCTYPE html>\n<div>x</div>')).toBe('<div>x</div>');
    });

    test('strips html/body wrappers; <head> and <title> blocks (with content) are nuked', () => {
        const input = '<html><head><meta charset="utf-8"><title>t</title></head><body><p>real</p></body></html>';
        expect(sanitizeHtmlBody(input)).toBe('<p>real</p>');
    });

    test('removes <style> blocks entirely', () => {
        const input = '<style>body{margin:40px}</style><p>ok</p>';
        expect(sanitizeHtmlBody(input)).toBe('<p>ok</p>');
    });

    test('removes <script> blocks entirely', () => {
        const input = '<p>ok</p><script>alert(1)</script>';
        expect(sanitizeHtmlBody(input)).toBe('<p>ok</p>');
    });

    test('full Haiku-style document is reduced to inner markup', () => {
        const input = `<!DOCTYPE html>
<html>
<head><style>body{margin:40px auto}</style></head>
<body><div class="card">hi</div></body>
</html>`;
        expect(sanitizeHtmlBody(input)).toBe('<div class="card">hi</div>');
    });

    test('trims leading/trailing whitespace', () => {
        expect(sanitizeHtmlBody('   <p>x</p>   ')).toBe('<p>x</p>');
    });

    test('case-insensitive on tags', () => {
        expect(sanitizeHtmlBody('<HTML><BODY><P>x</P></BODY></HTML>')).toBe('<P>x</P>');
    });
});
