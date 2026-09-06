import { expect, test } from "bun:test";
import search from "./googleSearch";

test("navigates to Google and returns deduplicated compact results", async () => {
    let navigated: any;
    const closed: string[] = [];
    const ctx = { fns: { cdp: { scope: async (opts: any) => ({ ...opts, bound: false }) }, browser: {
        navigate: async (opts: any) => { navigated = opts; },
        evaluate: async () => ({ title: "q - Google Search", blocked: false, results: [
            { title: "One", url: "https://one.test", snippet: "first" },
            { title: "One duplicate", url: "https://one.test", snippet: "duplicate" },
            { title: "Two", url: "https://two.test", snippet: "second" },
        ] }),
        tabClose: async ({ session }: any) => { closed.push(session); },
    } } } as unknown as Context;

    const result = await search(ctx, null, { query: "hello world", count: 2 });
    expect(navigated.url).toContain("q=hello%20world");
    expect(navigated.session).toBe("google-search");
    expect(closed).toEqual(["google-search"]);
    expect(result.results).toEqual([
        { title: "One", url: "https://one.test", snippet: "first" },
        { title: "Two", url: "https://two.test", snippet: "second" },
    ]);
});

test("reports Google consent/CAPTCHA instead of returning an empty list", async () => {
    const ctx = { fns: { cdp: { scope: async (opts: any) => ({ ...opts, bound: false }) }, browser: {
        navigate: async () => {},
        evaluate: async () => ({ blocked: true, results: [] }),
        tabClose: async () => {},
    } } } as unknown as Context;
    await expect(search(ctx, null, { query: "x" })).rejects.toThrow(/CAPTCHA/);
});
