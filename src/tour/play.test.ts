// FUNCTIONAL test: the tour is played in the browser, so it is tested in one —
// the real client.js in a real DOM, driven the way a person drives it.
//
// What is being pinned is the complaint that produced this player: the tour ran
// on a timer and moved the screen by itself, so nobody could tell where they had
// been taken or when. Every assertion below is a form of "nothing happens unless
// somebody presses something".
import { test, expect } from "bun:test";
import { Window } from "happy-dom";
import { testCtx } from "../$test";

const ctx = await testCtx();
const client = await (await ctx.fns.procs.http.dispatch({ url: "/screen/client.js" })).text();

const SCREEN = `<main id="main" data-page="patients">
  <h1>Patients</h1>
  <span data-entity="tab" data-id="ehr">EHR</span>
  <a href="/ehr/patient/anna" data-entity="patient" data-id="anna">Anna Ivanova</a>
  <button data-action="submit">Save</button>
</main>`;

function open() {
    const window = new Window({ url: "http://localhost/ehr" });
    window.document.body.innerHTML = SCREEN;
    new Function("window", "document", "location", client)(window, window.document, window.location);
    return window as any;
}

const panel = (w: any) => w.document.querySelector("#page-tour");
const said = (w: any) => panel(w).querySelector('[data-role="text"]').textContent;
const press = (w: any, action: string) => panel(w).querySelector(`[data-action="${action}"]`).click();

test("a tour starts on its first step and waits there", async () => {
    const w = open();
    const started = await w.page.tour({ steps: [
        { say: "Everyone in the box", point: { entity: "tab", id: "ehr" } },
        { say: "Open Anna", click: { entity: "patient", id: "anna" } },
        { say: "Nothing is saved until this", action: "submit" },
    ] });
    expect(started).toMatchObject({ tour: 3, at: 0, on: "screen" });
    expect(said(w)).toBe("Everyone in the box");
    expect(panel(w).querySelector('[data-role="count"]').textContent).toBe("Step 1 of 3");
    // Nothing moves on its own: a whole second later it is still step one.
    await Bun.sleep(1000);
    expect(said(w)).toBe("Everyone in the box");
    // …and the target is lit, so "where do I look" is answered on the screen.
    expect(w.document.querySelector("#page-spot").style.opacity).toBe("1");
});

test("Next walks forward, Back walks back, and the first step has no Back", async () => {
    const w = open();
    await w.page.tour({ steps: [{ say: "one" }, { say: "two" }] });
    expect(panel(w).querySelector('[data-action="back"]').disabled).toBe(true);
    press(w, "next");
    expect(said(w)).toBe("two");
    expect(panel(w).querySelector('[data-action="back"]').disabled).toBe(false);
    press(w, "back");
    expect(said(w)).toBe("one");
});

// The answer to "непонятно, когда совершился переход": it is the reader's own
// click that makes it. The tour waits on the highlighted control and follows.
test("a step that leads somewhere waits for the reader's own click", async () => {
    const w = open();
    let clicked = 0;
    w.document.querySelector('[data-entity="patient"]').addEventListener("click", () => clicked++);
    await w.page.tour({ steps: [{ say: "Open Anna", click: { entity: "patient", id: "anna" } }, { say: "Her chart" }] });
    expect(panel(w).querySelector('[data-action="next"]').textContent).toBe("Show me");
    expect(panel(w).querySelector('[data-role="where"]').textContent).toContain("Press the highlighted");

    w.document.querySelector('[data-entity="patient"]').click();
    expect(clicked).toBe(1);                       // theirs, not ours
    await Bun.sleep(600);
    expect(said(w)).toBe("Her chart");
});

// …and the other mode, which the panel offers by name: the tour presses, the
// reader only confirms they have followed.
test("Guide me makes the tour press for them", async () => {
    const w = open();
    let clicked = 0;
    w.document.querySelector('[data-entity="patient"]').addEventListener("click", () => clicked++);
    await w.page.tour({ steps: [{ say: "Open Anna", click: { entity: "patient", id: "anna" } }, { say: "Her chart" }], guided: true });
    // …and the button says what pressing it does: the tour acts, they confirm.
    expect(panel(w).querySelector('[data-action="next"]').textContent).toBe("Got it →");

    press(w, "next");
    await Bun.sleep(1500);        // the pointer flies there first — it is shown, not teleported
    expect(clicked).toBe(1);
    expect(said(w)).toBe("Her chart");
});

// Pressing "Guide me through it" and watching a label change is indistinguishable
// from pressing a dead button — the complaint, verbatim: "нажал на guide me
// through, тоже ничего не произошло". Taking over is an act: it takes over now.
test("Guide me through it takes over from where it is", async () => {
    const w = open();
    let clicked = 0;
    w.document.querySelector('[data-entity="patient"]').addEventListener("click", () => clicked++);
    await w.page.tour({ steps: [{ say: "Open Anna", click: { entity: "patient", id: "anna" } }, { say: "Her chart" }] });
    expect(panel(w).querySelector('[data-action="guide"]').textContent).toBe("Guide me through it");

    press(w, "guide");
    await Bun.sleep(1500);
    expect(clicked).toBe(1);                       // it did the step, then and there
    expect(said(w)).toBe("Her chart");
    expect(panel(w).querySelector('[data-action="guide"]').textContent).toBe("I'll click myself");
});

// A step that names no control is not a step with nothing to look at: it is
// about the page, so the page's own heading is outlined — and nothing is dimmed,
// because dimming a screen somebody is being told about hides it.
test("a step that names nothing marks the page it is talking about", async () => {
    const w = open();
    const went: string[] = [];
    w.page.go = async (d: any) => { went.push(d.url); };
    await w.page.tour({ steps: [{ say: "This is the register" }, { say: "and this is the form", open: "/forms" }] });
    expect(w.document.querySelector("#page-spot").style.opacity).toBe("1");
    expect(w.document.querySelector("#page-dim").dataset.mark).toBe("page");
    // …and the panel names where that is, in the words on the screen.
    expect(w.document.querySelector('#page-tour [data-role="where"]').textContent).toBe("Now: Patients");

    // The button says the next step is somewhere else — and the travelling
    // happens on the way IN to that step, so its sentence is read on the page it
    // is about and never over the one before it.
    expect(panel(w).querySelector('[data-action="next"]').textContent).toBe("Take me there →");
    expect(went).toEqual([]);
    press(w, "next");
    await Bun.sleep(200);
    expect(went).toEqual(["/forms"]);
    expect(said(w)).toBe("and this is the form");
});

test("the last step ends it, and ending clears the screen", async () => {
    const w = open();
    await w.page.tour({ steps: [{ say: "one" }, { say: "two" }] });
    press(w, "next");
    expect(panel(w).querySelector('[data-action="next"]').textContent).toBe("Done");
    press(w, "next");
    // Gone, not merely invisible: a faded panel still swallows every click in
    // that corner of the screen.
    expect(panel(w).dataset.open).toBeUndefined();
    expect(w.document.querySelector("#page-spot").style.opacity).toBe("0");
    expect(w.sessionStorage.getItem("tour.play")).toBeNull();
});

test("✕ ends it wherever it is", async () => {
    const w = open();
    await w.page.tour({ steps: [{ say: "one" }, { say: "two" }] });
    press(w, "exit");
    expect(panel(w).dataset.open).toBeUndefined();
});

// A tour that names something the page does not have still runs — a panel that
// explains nothing is worse than one that explains without pointing — but it
// says so, and `page.tour` turns that into the note the author needs.
test("a step whose target is not on screen is reported, not fatal", async () => {
    const w = open();
    const started = await w.page.tour({ steps: [{ say: "hm", entity: "patient", id: "nobody" }] });
    expect(started.on).toBe("elsewhere");
    expect(said(w)).toBe("hm");
    // The page it is on is marked instead — the reader is never left with a
    // panel talking about something nothing on the screen points to.
    expect(w.document.querySelector("#page-dim").dataset.mark).toBe("page");
});

// The crumb that lets a reload resume a tour let a tour from another sitting
// come back for ever — a panel about a screen nobody had been near since, on
// every reload, with no way out but to notice it and close it.
test("a tour older than half an hour is not resumed", async () => {
    const w = open();
    await w.page.tour({ steps: [{ say: "one" }, { say: "two" }] });
    const kept = JSON.parse(w.sessionStorage.getItem("tour.play")!);
    expect(kept.at).toBeGreaterThan(0);

    // A fresh page with that crumb already in it: this morning's resumes…
    const fresh = new Window({ url: "http://localhost/ehr" }) as any;
    fresh.document.body.innerHTML = SCREEN;
    fresh.sessionStorage.setItem("tour.play", JSON.stringify(kept));
    new Function("window", "document", "location", client)(fresh, fresh.document, fresh.location);
    expect(fresh.document.querySelector('#page-tour [data-role="text"]').textContent).toBe("one");

    // …an afternoon-old one does not, and takes its crumb with it.
    const stale = new Window({ url: "http://localhost/ehr" }) as any;
    stale.document.body.innerHTML = SCREEN;
    stale.sessionStorage.setItem("tour.play", JSON.stringify({ ...kept, at: kept.at - 31 * 60 * 1000 }));
    new Function("window", "document", "location", client)(stale, stale.document, stale.location);
    expect(stale.document.querySelector("#page-tour")).toBeNull();
    expect(stale.sessionStorage.getItem("tour.play")).toBeNull();
});

// …and once it has taken over it keeps walking. "Guide me through it" used to do
// exactly one step and then sit there waiting for the next press, which is the
// manual mode with a different label — the complaint, verbatim: "я нажал Guide me
// through it, и только один скролл произошёл".
//
// The bar across the foot is why a timer is allowed back at all: the tour this
// player replaced moved the screen on a timer with nothing saying when, and
// nothing to press about it. Here the next move is visible before it happens,
// and "I'll click myself" takes the tour back.
test("Guide me through it keeps walking, and the bar says when", async () => {
    const w = open();
    await w.page.tour({ steps: [{ say: "one" }, { say: "two" }, { say: "three" }], guided: true });

    const bar = () => panel(w).querySelector('[data-role="timer"]');
    expect(bar().style.width).toBe("100%");            // …filling, over the step's own time
    expect(panel(w).querySelector('[data-role="where"]').textContent).toContain("moving on by itself");

    await Bun.sleep(7600);
    expect(said(w)).toBe("two");                       // nobody pressed anything

    press(w, "guide");                                 // I'll click myself
    expect(bar().style.width).toBe("0%");
    await Bun.sleep(1200);
    expect(said(w)).toBe("two");                       // …and it stays put
}, 20_000);

// A step that walks to ANOTHER patient's page lands on a different name in the
// same layout, which reads as the app having lost the patient. The complaint,
// verbatim: "вот тут был один юзер, а следующим шагом уже другой… это сильно
// сбивает пользователя". The button before it says whose page it is going to.
test("a step that changes who the page is about says whose", async () => {
    const w = open();
    await w.page.tour({ steps: [
        { say: "Omar is filling his in", open: "/portal/patient/omar" },
        { say: "Anna already sent hers", open: "/portal/patient/anna" },
    ] });

    expect(panel(w).querySelector('[data-action="next"]').textContent).toBe("Take me to anna →");
});

test("…and going somewhere about the same patient does not name them again", async () => {
    const w = open();
    await w.page.tour({ steps: [
        { say: "Her portal", open: "/portal/patient/anna" },
        { say: "Her forms", open: "/portal/patient/anna/forms" },
    ] });

    expect(panel(w).querySelector('[data-action="next"]').textContent).toBe("Take me there →");
});

// A step that CLICKS something the page does not have cannot merely be reported
// — the tour has nowhere to go. It used to print the verb's own message, which
// is a CSS selector, into the face of somebody being shown around:
// `no entity: [data-entity="todo"][data-id="intake"]`. And in the guided mode
// nobody is pressing anything, so a dead end is where the tour ends.
test("a step that cannot be done says so in words, and can be stepped over", async () => {
    const w = open();
    await w.page.tour({ steps: [
        { say: "Open your intake", click: { entity: "todo", id: "intake" } },
        { say: "…and here it is" },
    ], guided: true });

    await Bun.sleep(7600);                              // the bar fills, the tour tries
    const where = () => panel(w).querySelector('[data-role="where"]').textContent;
    expect(where()).toBe("This step is about “intake”, and this page has nothing by that name.");
    expect(panel(w).querySelector('[data-action="next"]').textContent).toBe("Step over it →");
    // The clock is stopped: a guided tour does not walk over its own wreckage.
    expect(panel(w).querySelector('[data-role="timer"]').style.width).toBe("0%");

    press(w, "next");
    await Bun.sleep(50);
    expect(said(w)).toBe("…and here it is");
}, 20_000);
