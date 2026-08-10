// FUNCTIONAL test: review.test.ts ↔ review.ts — a tour is read off the pages it
// names, with no browser anywhere. The fixture is a three-page project, because
// the answer that matters most (which pages nobody is taken to) is only true
// relative to a project.
import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";
import { testCtx } from "../$test";

const PAGES: Record<string, string> = {
    "ehr/$route__GET.ts": `<main data-page="patients"><h1>Patients</h1>
        <span data-entity="tab" data-id="forms">Forms</span>
        <div data-entity="patient" data-id="anna"><a href="/ehr/patient/anna">Anna Ivanova</a></div></main>`,
    "ehr/$route_patient_$id_GET.ts": `<main data-page="chart"><h1>Anna</h1>
        <button data-action="submit">Save</button></main>`,
    "ehr/$route_inbox_GET.ts": `<main data-page="inbox"><h1>Inbox</h1></main>`,
};

const dir = mkdtempSync(join(tmpdir(), "page-review-"));
// The fixture is its own tiny app, and `tour.review` is the one thing it
// mounts — by path, so the rest of ../libs (an ehr that also serves /ehr)
// stays out of its route table.
writeFileSync(join(dir, "package.json"), JSON.stringify({
    name: "fixture",
    // screen/tour live in this repo's core src now — nothing to mount.
    procs: { src: "src" },
}));
mkdirSync(join(dir, "src", "ehr"), { recursive: true });
for (const [rel, markup] of Object.entries(PAGES)) {
    writeFileSync(join(dir, "src", rel), `export default function () { return ${JSON.stringify(markup)}; }\n`);
}
const ctx = await testCtx({ root: dir, workdir: dir, env: { PROCS_PATH: "" } });

test("a step is read on the page it opened, and a click carries the tour to the next one", async () => {
    const review: any = await ctx.fns.tour.review({ steps: [
        { say: "Everyone in the box", open: "/ehr", point: { entity: "tab", id: "forms" } },
        { say: "Open Anna", click: { entity: "patient", id: "anna" } },
        { say: "Nothing is saved until this", action: "submit" },
    ] });

    expect(review.start).toBe("/ehr");
    expect(review.steps.map((s: any) => [s.n, s.url, s.on])).toEqual([
        [1, "/ehr", "screen"],
        [2, "/ehr", "screen"],
        [3, "/ehr/patient/anna", "screen"],   // the click was followed
    ]);
    expect(review.steps[2].target).toBe("action:submit");
});

test("a target the page does not have is `elsewhere`, and a step naming nothing is `nothing`", async () => {
    const review: any = await ctx.fns.tour.review({ steps: [
        { say: "Her chart", open: "/ehr/patient/anna", point: { entity: "tab", id: "forms" } },
        { say: "And that is the app" },
    ] });

    expect(review.steps.map((s: any) => s.on)).toEqual(["elsewhere", "nothing"]);
});

test("a page that does not answer is reported with its status, not thrown", async () => {
    const review: any = await ctx.fns.tour.review({ steps: [{ say: "Off the map", open: "/ehr/nowhere" }] });
    expect(review.steps[0].on).toStartWith("missing");
});

test("the pages of the project nobody is taken to come back by name", async () => {
    const short: any = await ctx.fns.tour.review({ steps: [{ say: "Everyone in the box", open: "/ehr" }] });
    expect(short.missed).toEqual(["/ehr/inbox", "/ehr/patient/:id"]);

    // …and a page with a parameter is reached the moment one of its instances is.
    const full: any = await ctx.fns.tour.review({ steps: [
        { say: "Everyone in the box", open: "/ehr" },
        { say: "Her chart", open: "/ehr/patient/anna" },
        { say: "What has come in", open: "/ehr/inbox" },
    ] });
    expect(full.missed).toEqual([]);
});

test("a tour with no steps is a mistake worth saying out loud", async () => {
    expect(ctx.fns.tour.review({ steps: [] })).rejects.toThrow("a tour needs steps");
});

// …and the check rides on GIVING a tour, not on being asked for one. The way a
// tour fails is not by breaking: it is by being a tour of one case — seven steps
// about the intake, with the queue it feeds never named. So `page.tour` answers
// with what it did not show, in the same breath as starting it.
test("giving a tour answers with the pages it does not show", async () => {
    (ctx.state.registry as any).screen.eval = async () => ({ tour: 1, at: 0, on: "screen" });

    const started: any = await ctx.fns.tour.play({ steps: [{ say: "Everyone in the box", open: "/ehr" }] });
    expect(started.missed).toEqual(["/ehr/inbox", "/ehr/patient/:id"]);
});
