// FUNCTIONAL test: libs/screen/src/screen.test.ts ↔ the screen/ namespace — the wire
// the coding agent drives the open tab over. It has three ends in three files
// joined by nothing but strings: `eval` counts the connected tabs on
// ctx.state.procs.events, pushes the code down the event stream, and the tab
// posts the answer back to POST /screen/result. Two of those strings went
// stale when the framework moved under its own name, and every break on this
// wire looks identical from outside — a verb that times out. So drive the round
// trip rather than the parts.
import { test, expect } from "bun:test";
import { testCtx } from "./$test";

const ctx = await testCtx();

test("a tab's answer comes back through the route the layout posts to", async () => {
    // The tab: subscribed to the event stream, running what it is sent, posting
    // the result to /screen/result — the browser half, minus the browser.
    const off = ctx.fns.procs.events.subscribe({
        handler: (e: any) => {
            if (e.type !== "eval") return;
            ctx.fns.procs.http.dispatch({ method: "POST", url: "/screen/result", body: { id: e.id, value: { ran: e.code } } });
        },
    });
    expect(await ctx.fns.screen.eval({ code: "return 1", timeoutMs: 2_000 })).toEqual({ ran: "return 1" });
    off();
});

test("a connected tab that stays quiet is a silent page, not no page at all", async () => {
    // The two failures need different answers from the user — reopen the tab, or
    // look at why it choked — so the count has to come off the state the event
    // stream actually keeps its subscribers on.
    const off = ctx.fns.procs.events.subscribe({ handler: () => {} });
    await expect(ctx.fns.screen.eval({ code: "return 1", timeoutMs: 200 })).rejects.toThrow("the page did not answer in 200ms");
    off();
});

// Where the person is, without stopping to ask them. `readScreen` is a round
// trip through the event stream and only works while a tab is open; "where are
// you" is asked before every reply, so the tab volunteers it instead.
test("an open tab says where it is, and where() reads it without a round trip", async () => {
    expect(ctx.fns.screen.where({})).toBeNull();

    const said = await ctx.fns.procs.http.dispatch({
        url: "/screen/here", method: "POST",
        body: JSON.stringify({ url: "/ehr/patient/seed-anna?tab=apps", title: "Anna Ivanova", page: "chart" }),
        headers: { "content-type": "application/json" },
    });
    expect(said.status).toBe(204);

    const here = ctx.fns.screen.where({})!;
    expect(here.url).toBe("/ehr/patient/seed-anna?tab=apps");
    expect(here.page).toBe("chart");
    expect(here.stale).toBe(false);
    // …and it is honest about age: a tab that said nothing for a while may be
    // closed, on another window, or looking at something else entirely.
    expect(ctx.fns.screen.where({ staleAfterMs: -1 })!.stale).toBe(true);

    // A beacon with no url changes nothing rather than blanking what we knew.
    await ctx.fns.procs.http.dispatch({ url: "/screen/here", method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    expect(ctx.fns.screen.where({})!.url).toBe("/ehr/patient/seed-anna?tab=apps");
});
