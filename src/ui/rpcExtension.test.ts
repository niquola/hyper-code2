import { expect, test } from 'bun:test';

test('popup RPC extension keeps source HTML compact and uses htmx transport', async () => {
    const source = await Bun.file(new URL('./$script_rpc.js', import.meta.url)).text();
    expect(source).toContain("closest?.('[hx-popup]')");
    expect(source).toContain("htmx.ajax('POST', '/rpc'");
    expect(source).not.toContain("fetch('/rpc'");
    expect(source).not.toContain("setAttribute('hx-post'");
});
