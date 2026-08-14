import { expect, test } from 'bun:test';
import render from './popup';
const ctx: any = { fns: { procs: { ui: { escape: ({ text }: any) => String(text).replaceAll('&', '&amp;').replaceAll('"', '&quot;') } } } };
test('popup helper emits the compact contract', () => {
    const html = render(ctx, null, { method: 'ui.popupDemo', params: { id: 1 }, html: 'Open' });
    expect(html).toContain('hx-popup="ui.popupDemo"');
    expect(html).toContain('hx-popup-params="{&quot;id&quot;:1}"');
    expect(html).not.toContain('hx-post');
    expect(html).not.toContain('hx-target');
});
