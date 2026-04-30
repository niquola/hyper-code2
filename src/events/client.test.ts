import { describe, test, expect } from "bun:test";

describe("events/client.js", () => {
  test("re-emits SSE payloads as hyper-events DOM events", async () => {
    const js = await Bun.file('src/events/client.js').text();
    expect(js).toContain("CustomEvent('hyper-events'");
    expect(js).toContain("new EventSource('/events')");
  });
  test("contains agents.changed handler", async () => {
    const js = await Bun.file('src/events/client.js').text();
    expect(js).toContain('agents.changed');
    expect(js).toContain('__hyperRefreshSidebar');
    expect(js).toContain("new EventSource('/events')");
  });
});
