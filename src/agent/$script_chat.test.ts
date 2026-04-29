import { describe, test, expect } from "bun:test";

describe('agent chat UI delete affordances', () => {
  test('chat script places inline sure controls in top-right hover area', async () => {
    const js = await Bun.file('src/agent/$script_chat.js').text();
    expect(js).toContain('/messages/delete');
    expect(js).toContain("btn.textContent = 'sure?'");
    expect(js).toContain('absolute right-2 top-2');
    expect(js).toContain('group-hover:opacity-100');
  });
});
