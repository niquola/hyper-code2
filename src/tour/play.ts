// Walk somebody through something — a list of steps, handed to the page they
// are looking at. **This call returns as soon as the tour has started**: the
// person taking it is the one who advances it, one step at a time, from the
// panel it puts on their screen.
//
//   await ctx.fns.tour.play({ steps: [
//     { say: "This is every patient in the box", open: "/ehr" },
//     { say: "Open Anna — her chart is where your screen lives",
//       click: { entity: "patient", id: "seed-anna" } },
//     { say: "Forms is where a questionnaire is answered", click: { entity: "tab", id: "forms" } },
//     { say: "Nothing is saved until this is pressed", action: "submit" } ] })
//
// A step is one sentence and, at most, one thing to do. Say it BEFORE the doing:
// the sentence is read, the control it names is lit up, and the step is over
// when it is pressed — by them, or by `Show me` on their behalf. `guided: true`
// starts in the mode where the tour walks itself: each step is read, a bar fills
// across the foot of the panel, and it moves on by itself when the bar is full.
// `I'll click myself` stops it where it stands and hands it back.
//
// **`open` is the exception, and it travels on the way IN.** A step's sentence
// is about the screen it names, so a step that opens another page opens it
// first and speaks there; the button on the step before says where pressing it
// goes. Otherwise the sentence for a page nobody has reached yet is read over
// the page they are still on — "the appointment queue, Omar has sent his form"
// with a patient's own portal on the screen.
//
// It used to run here, on `sleep`, driving their screen: captions faded on a
// timer, pages changed under whoever was reading, and there was nothing to press
// to stop, repeat or slow down. Steps are the same shape; only who plays them
// changed.
export default async function (ctx: Context, _session: Session | null, opts: { steps: types.tour.Step[]; guided?: boolean; title?: string }) {
    const steps = (opts.steps ?? []).filter(Boolean);
    if (!steps.length) throw new Error("a tour needs steps");

    const started: any = await ctx.fns.screen.eval({
        code: `return window.page.tour(${JSON.stringify({ steps, guided: opts.guided, title: opts.title })})`,
        timeoutMs: 20_000,
    });

    // …and what it does NOT show, in the same breath. A tour is the answer to
    // "show me what you built", and the way it fails is not by breaking — it is
    // by being a tour of one case: the intake gets seven steps and the queue, the
    // inbox and the orders it feeds are never named, so the reader is shown a
    // corner and told it is the product. `review` costs milliseconds and no
    // browser, so it rides on giving the tour rather than waiting to be asked
    // for: whoever plays one is told, at once, which of the project's pages
    // nobody was taken to.
    const missed = await ctx.fns.tour.review({ steps }).then(r => r.missed).catch(() => []);

    // The first step is the one that must land: a tour that opens pointing at
    // something the screen does not have has misread the page, and saying so now
    // is worth more than a panel that quietly explains nothing.
    if (started?.on === "elsewhere") {
        return { ...started, missed, note: `step 0 names nothing on screen${await onScreen(ctx, steps[0]!)}` };
    }
    return { ...started, missed };
}

// What the screen actually offers, when a step could not find its target. Best
// effort: a page that has gone away answers nothing, and a tour that started
// anyway should not fail for asking.
async function onScreen(ctx: Context, step: types.tour.Step): Promise<string> {
    const wanted = (step.click ?? step.point ?? (step.entity || step.action ? step : null)) as any;
    const kind = wanted?.entity ? "entity" : wanted?.action ? "action" : null;
    if (!kind) return "";
    const screen: any = await ctx.fns.screen.readScreen({}).catch(() => null);
    if (!screen) return "";
    const there = kind === "entity"
        ? (screen.entities ?? []).filter((e: any) => e.entity === wanted.entity).map((e: any) => e.id)
        : (screen.actions ?? []).map((a: any) => a.action);
    return there.length
        ? ` — on screen now: ${[...new Set(there)].slice(0, 12).join(", ")}`
        : `; \`page.readScreen({})\` says what is`;
}
