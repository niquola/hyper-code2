// A LIVE step: one turn of guidance. The guide plays it and returns; the
// person's press comes back as a beacon to /screen/press — nothing waits on
// the wire. Tested like the tour player: the real client.js in a real DOM,
// with the beacon captured.
import { test, expect } from "bun:test";
import { Window } from "happy-dom";
import { testCtx } from "../$test";

const ctx = await testCtx();
const client = await (await ctx.fns.procs.http.dispatch({ url: "/screen/client.js" })).text();

const SCREEN = `<main id="main" data-page="patients">
  <h1>Patients</h1>
  <a href="/ehr/patient/anna" data-entity="patient" data-id="anna">Anna Ivanova</a>
</main>`;

function open() {
    const window = new Window({ url: "http://localhost/ehr" });
    window.document.body.innerHTML = SCREEN;
    const sent: any[] = [];
    (window.navigator as any).sendBeacon = (_url: string, blob: Blob) => { sent.push(blob); return true; };
    new Function("window", "document", "location", client)(window, window.document, window.location);
    return { w: window as any, said: async () => sent.length ? JSON.parse(await (sent.at(-1) as Blob).text()) : null };
}

const panel = (w: any) => w.document.querySelector("#page-tour");

test("a solo step draws the sentence without the excursion chrome", async () => {
    const { w } = open();
    const on = await w.page.step({ say: "Это Анна", point: { entity: "patient", id: "anna" } });
    expect(on).toMatchObject({ step: "Это Анна", on: "screen" });
    expect(panel(w).querySelector('[data-role="text"]').textContent).toBe("Это Анна");
    // One turn of a conversation, not "Step 1 of 1" of a one-step excursion.
    expect(panel(w).querySelector('[data-role="count"]').textContent).not.toContain("Step 1");
    expect(panel(w).querySelector('[data-action="back"]').style.display).toBe("none");
    expect(panel(w).querySelector('[data-action="guide"]').style.display).toBe("none");
    expect(panel(w).querySelector('[data-role="dots"]').innerHTML).toBe("");
});

test("Next hands the floor back as a beacon, and the panel closes", async () => {
    const { w, said } = open();
    await w.page.step({ say: "Это Анна", point: { entity: "patient", id: "anna" } });
    panel(w).querySelector('[data-action="next"]').click();
    await Bun.sleep(50);
    expect(panel(w).dataset.open).toBeUndefined();
    expect(await said()).toMatchObject({ pressed: "next", say: "Это Анна" });
});

test("End tour is a visible button, and it answers stop", async () => {
    const { w, said } = open();
    await w.page.step({ say: "Это Анна", point: { entity: "patient", id: "anna" } });
    const end = [...panel(w).querySelectorAll('[data-action="exit"]')].find((b: any) => b.textContent === "End tour");
    expect(end).toBeTruthy();
    (end as any).click();
    await Bun.sleep(50);
    expect(panel(w).dataset.open).toBeUndefined();
    expect((await said())?.pressed).toBe("stop");
});

test("their own click on the lit control answers did-it", async () => {
    const { w, said } = open();
    await w.page.step({ say: "Открой Анну", click: { entity: "patient", id: "anna" } });
    w.document.querySelector('[data-entity="patient"]').click();
    await Bun.sleep(600);
    expect((await said())?.pressed).toBe("did-it");
});

test("a step about something the page lacks answers failed, and stays", async () => {
    const { w, said } = open();
    await w.page.step({ say: "Нажми то, чего нет", click: { entity: "patient", id: "boris" } });
    panel(w).querySelector('[data-action="next"]').click();
    await Bun.sleep(100);
    expect((await said())?.pressed).toBe("failed");
    expect((await said())?.stuck).toContain("boris");
    expect(panel(w).dataset.open).toBe("1");        // still on screen, saying why
});

test("the guide's next step displaces the last one without a phantom press", async () => {
    const { w, said } = open();
    await w.page.step({ say: "Первый" });
    await w.page.step({ say: "Второй" });
    expect(await said()).toBeNull();                 // displacement is not a press
    expect(panel(w).querySelector('[data-role="text"]').textContent).toBe("Второй");
});
