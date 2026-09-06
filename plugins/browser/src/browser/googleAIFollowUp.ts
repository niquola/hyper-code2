// Ask a follow-up in an existing Google AI Mode conversation. Reusing the same
// named CDP session is what preserves conversational context.
/**
 * Asks a follow-up question in an open Google AI conversation.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
  /** Follow-up question to submit. */
  question: string;
  /** Google AI browser session name. */
  session?: string;
  /** Maximum wait for the answer in milliseconds. */
  timeoutMs?: number },
) {
    const question = String(opts.question ?? "").trim();
    if (!question) throw new Error("browser.googleAIFollowUp: question is required");
    const scope = await ctx.fns.cdp.scope({ session: opts.session });
    const session = scope.session || "google-ai";
    const timeoutMs = Math.max(5_000, Math.min(Number(opts.timeoutMs ?? 45_000), 120_000));

    const submitted = await ctx.fns.browser.evaluate({ session, expression: `(() => {
      const t = document.querySelector('textarea[placeholder="Ask anything"]');
      if (!t) return false;
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      set.call(t, ${JSON.stringify(question)});
      t.dispatchEvent(new Event("input", { bubbles: true }));
      t.dispatchEvent(new Event("change", { bubbles: true }));
      t.focus();
      return true;
    })()` });
    if (!submitted) throw new Error("browser.googleAIFollowUp: this session is not on a Google AI Mode conversation");
    // Google listens to trusted keyboard events; CDP Input creates one, while a
    // synthetic DOM KeyboardEvent does not submit the composer.
    // Google's controlled textarea enables submission asynchronously.
    await Bun.sleep(300);
    for (const type of ["keyDown", "keyUp"]) await ctx.fns.cdp.send({ session, method: "Input.dispatchKeyEvent", params: {
        type, key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
    } });

    const deadline = Date.now() + timeoutMs;
    let state: any = null;
    while (Date.now() < deadline) {
        state = await ctx.fns.browser.evaluate({ session, expression: `(() => {
          const body = (document.body?.innerText || "").replace(/\\u00a0/g, " ");
          const start = body.lastIndexOf(${JSON.stringify(question)});
          if (start < 0) return { ready: false, answer: "" };
          const from = start + ${JSON.stringify(question)}.length;
          const end = body.indexOf("AI responses may include mistakes", from);
          const answer = body.slice(from, end >= 0 ? end : undefined).trim();
          return { title: document.title, url: location.href,
            ready: end >= 0 && answer.length > 0 && /AI Mode response is ready/i.test(body.slice(from)), answer };
        })()` });
        if (state?.ready) break;
        await Bun.sleep(700);
    }
    if (!state?.ready) throw new Error(`browser.googleAIFollowUp: no answer after ${Math.round(timeoutMs / 1000)}s`);
    return { question, title: state.title, url: state.url, answer: state.answer };
}
