// Ask Google AI Mode through the user's real Chrome session. Starts a fresh
// query, waits for the generated answer, and returns the answer text plus the
// visible source links. This is browser automation, not an undocumented API.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { question: string; followUps?: string[]; session?: string; language?: string; timeoutMs?: number; keepOpen?: boolean },
) {
    const question = String(opts.question ?? "").trim();
    if (!question) throw new Error("browser.googleAI: question is required");
    const session = opts.session || "google-ai";
    const language = String(opts.language || "en").replace(/[^a-z-]/gi, "");
    const timeoutMs = Math.max(5_000, Math.min(Number(opts.timeoutMs ?? 45_000), 120_000));
    const url = `https://www.google.com/search?q=${encodeURIComponent(question)}&hl=${encodeURIComponent(language)}&udm=50`;
    // A conversation with follow-ups remains available by default so it can be
    // continued with googleAIFollowUp. One-shot questions clean up their tab.
    const keepOpen = opts.keepOpen ?? Boolean(opts.followUps?.length);
    try {
        await ctx.fns.browser.navigate({ session, url, settleMs: 900 });

    const deadline = Date.now() + timeoutMs;
    let state: any = null;
    while (Date.now() < deadline) {
        state = await ctx.fns.browser.evaluate({ session, expression: extractExpression(question) });
        if (state?.blocked) throw new Error("browser.googleAI: Google requires login, consent, or CAPTCHA");
        if (state?.ready && state?.answer) break;
        await Bun.sleep(700);
    }
        if (!state?.answer) throw new Error(`browser.googleAI: no answer after ${Math.round(timeoutMs / 1000)}s`);
        const turns: any[] = [{ question, answer: state.answer, sources: state.sources }];
        for (const followUp of opts.followUps ?? []) {
            turns.push(await ctx.fns.browser.googleAIFollowUp({ question: followUp, session, timeoutMs }));
        }
        return { question, url: state.url, title: state.title, answer: state.answer, sources: state.sources, turns };
    } finally {
        if (!keepOpen) await ctx.fns.browser.tabClose({ session }).catch(() => {});
    }
}

function extractExpression(question: string): string {
    return `(() => {
      const body = (document.body?.innerText || "").replace(/\\u00a0/g, " ");
      const blocked = /unusual traffic|not a robot|detected unusual|before you continue|sign in to continue/i.test(body);
      const ready = /AI Mode response is ready/i.test(body) || /AI responses may include mistakes/i.test(body);
      const q = ${JSON.stringify(question)};
      let answer = "";
      const marker = "AI Mode conversation: " + q;
      let start = body.indexOf(marker);
      if (start >= 0) {
        start += marker.length;
        const repeated = body.indexOf(q, start);
        if (repeated >= 0 && repeated - start < 500) start = repeated + q.length;
        const ends = ["AI responses may include mistakes", "AI Mode response is ready"]
          .map(x => body.indexOf(x, start)).filter(x => x >= 0);
        answer = body.slice(start, ends.length ? Math.min(...ends) : undefined).trim();
      }
      const sources = [...document.querySelectorAll("a")].map(a => ({
        title: (a.innerText || "").trim(), url: a.href
      })).filter(x => x.title && /^https?:/.test(x.url) && !x.url.includes("google.com/search"));
      const seen = new Set();
      return { title: document.title, url: location.href, blocked, ready, answer,
        sources: sources.filter(x => !seen.has(x.url) && seen.add(x.url)).slice(0, 12) };
    })()`;
}
