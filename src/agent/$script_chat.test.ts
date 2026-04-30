import { describe, test, expect } from "bun:test";

describe('agent chat UI backend-rendered events', () => {
  test('chat script appends server-rendered html and wires delete controls', async () => {
    const js = await Bun.file('src/agent/$script_chat.js').text();
    expect(js).toContain('function addHtml(html, usage)');
    expect(js).toContain('while (wrap.firstChild) messagesEl.appendChild(wrap.firstChild)');
    expect(js).toContain('wireDeleteControls(messagesEl)');
    expect(js).toContain("btn.textContent = 'sure?'");
    expect(js).toContain('/messages/delete');
    expect(js).toContain("agent.thinking.delta");
    expect(js).toContain("agent.thinking.done");
    expect(js).toContain("thinking-overlay");
  });
});
