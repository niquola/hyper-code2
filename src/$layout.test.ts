import { describe, test, expect } from "bun:test";
import layout from "./$layout";

const mkCtx = () => ({
  state: { agent: {} },
  env: {},
  fns: { session: { list: () => [{ id: 'a1', model: 'm', title: 't', turns: 1, isStreaming: false }] }, files: { listOpen: () => [] } },
} as unknown as Context);

describe("$layout sidebar fragment", () => {
  test("returns only aside for sidebar fragment requests", () => {
    const req = new Request('http://x/', { headers: { 'x-hyper-fragment': 'sidebar' } });
    const html = layout(mkCtx(), { main: 'x' }, req) as string;
    expect(html.trim().startsWith('<aside')).toBe(true);
    expect(html).not.toContain('<html');
  });
});
