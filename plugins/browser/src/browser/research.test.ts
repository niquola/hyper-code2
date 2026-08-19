import { expect, test } from "bun:test";
import research from "./research";

test("reads result pages through navigate and snapshot", async () => {
    const navigated: any[] = [];
    const snapshots: any[] = [];
    const closed: any[] = [];
    const ctx = { fns: { browser: {
        googleSearch: async () => ({ url: "https://google.test/search", results: [{ title: "One", url: "https://one.test", snippet: "s" }] }),
        navigate: async (opts: any) => { navigated.push(opts); },
        snapshot: async (opts: any) => {
            snapshots.push(opts);
            return { title: "One final", url: "https://one.test/final", content: "Readable", truncated: false };
        },
        closeSessions: async (opts: any) => { closed.push(opts); return { closed: [] }; },
    } } } as unknown as Context;

    const result = await research(ctx, null, { query: "q", pages: 1, session: "job", maxCharsPerPage: 700 });
    expect(navigated).toEqual([{ session: "job-page-1", url: "https://one.test", settleMs: 900 }]);
    expect(snapshots).toEqual([{ session: "job-page-1", mode: "text", readable: true, maxChars: 700, maxNodes: 2_000, depth: 40 }]);
    expect(result.documents[0]).toMatchObject({ title: "One final", url: "https://one.test/final", content: "Readable", text: "Readable", format: "text", error: null });
    expect(closed).toContainEqual({ sessions: ["job-page-1"] });
    expect(closed).toContainEqual({ prefix: "job-" });
});

test("keepOpen leaves research page sessions available", async () => {
    const closed: any[] = [];
    const ctx = { fns: { browser: {
        googleSearch: async () => ({ url: "search", results: [{ title: "One", url: "https://one.test" }] }),
        navigate: async () => {},
        snapshot: async () => ({ title: "One", url: "https://one.test", content: "Body", truncated: false }),
        closeSessions: async (opts: any) => { closed.push(opts); },
    } } } as unknown as Context;
    await research(ctx, null, { query: "q", pages: 1, session: "job", keepOpen: true });
    expect(closed).toEqual([]);
});
