import { describe, test, expect } from "bun:test";
import renderEventHtml from "./renderEventHtml";

const ctx = {} as Context;

describe("agent.renderEventHtml", () => {
  test("renders tool_call as details", async () => {
    const html = await renderEventHtml(ctx, { type: "tool_call", name: "evalCode", argsHtml: "<pre>a</pre>", resultHtml: "<pre>b</pre>", result: "b", args: { code: "a" }, isError: false });
    expect(html).toContain("<details");
    expect(html).toContain("tool: evalCode");
    expect(html).toContain("<pre>a</pre>");
    expect(html).toContain("<pre>b</pre>");
  });

  test("renders assistant as left bubble with inner prose block", async () => {
    const html = await renderEventHtml(ctx, { type: "assistant", html: "<p>ok</p>", usage: { prompt_tokens: 1234, total_tokens: 1300 }, messageIdx: 7 });
    expect(html).toContain("justify-start");
    expect(html).toContain("rounded-2xl bg-gray-50");
    expect(html).toContain("prose prose-sm max-w-none");
    expect(html).toContain(`data-delete-idx="7"`);
  });

  test("renders user with delete controls and right alignment", async () => {
    const html = await renderEventHtml(ctx, { type: "user", text: "hi", messageIdx: 3 });
    expect(html).toContain("justify-end");
    expect(html).toContain("bg-gray-900");
    expect(html).toContain(`data-delete-mode="one"`);
    expect(html).toContain(`data-delete-mode="from"`);
  });
});
