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
    expect(js).toContain("tool-toast-layer");
    expect(js).toContain("function showToolToast(ev)");
    expect(js).toContain("summarizeToolCall(ev)");
    expect(js).toContain("if (ev.type === 'tool_call') showToolToast(ev);");
    expect(js).toContain("function summarizeToolResult(ev)");
    expect(js).toContain("let activeToolToast = null;");
    expect(js).toContain("fadeToolToast(activeToolToast)");
    expect(js).toContain("setTimeout(() => fadeToolToast(entry), 15000)");
    expect(js).toContain("lines.slice(0, 50)");
    expect(js).toContain("more lines");
    expect(js).toContain("w-[min(56rem,calc(100vw-2rem))]");
    expect(js).toContain("max-h-[55vh]");
    expect(js).toContain("max-h-[30vh]");
    expect(js).toContain("argsHtml");
    expect(js).toContain("resultHtml");
    expect(js).toContain("code-preview font-mono text-[11px] leading-snug text-gray-700");
    expect(js).toContain("result-preview");
    expect(js).toContain("rounded-3xl");
    expect(js).toContain("border border-gray-300/90 px-4 py-4 shadow-xl backdrop-blur bg-white text-gray-800 ring-1 ring-black/5");
    expect(js).toContain("rounded-2xl bg-white px-3 py-2 code-preview");
    expect(js).toContain("rounded-2xl bg-white px-3 py-2 result-preview");
    expect(js).toContain("my-3 h-px");
    expect(js).toContain("innerHTML = callData.html");
    expect(js).toContain("innerHTML = resultData.html");
  });
});
