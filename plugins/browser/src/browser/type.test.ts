import { expect, test } from "bun:test";
import typeText from "./type";

test("types characters through CDP Input.insertText", async () => {
    const pressed: any[] = [];
    const sent: any[] = [];
    const ctx = { fns: {
        browser: {
            press: async (opts: any) => { pressed.push(opts); return { key: opts.key }; },
            evaluate: async () => "Copenhagen",
        },
        cdp: { scope: async (opts: any) => ({ ...opts, bound: false }),
            send: async (opts: any) => { sent.push(opts); return {}; },
        },
    } } as unknown as Context;

    const result = await typeText(ctx, null, {
        session: "page",
        target: { css: "#destination" },
        text: "CPH",
    });

    expect(pressed).toEqual([{ session: "page", target: { css: "#destination" }, key: "ArrowRight", timeoutMs: undefined }]);
    expect(sent.map(call => call.params.text)).toEqual(["C", "P", "H"]);
    expect(result).toEqual({ typed: 3, value: "Copenhagen" });
});

test("clear selects and removes existing content before typing", async () => {
    const pressed: string[] = [];
    const ctx = { fns: {
        browser: {
            press: async ({ key }: any) => { pressed.push(key); return { key }; },
            evaluate: async () => "new",
        },
        cdp: { scope: async (opts: any) => ({ ...opts, bound: false }), send: async () => ({}) },
    } } as unknown as Context;

    const result = await typeText(ctx, null, { target: { ref: "r1e1" }, text: "new", clear: true });
    expect(pressed).toEqual([process.platform === "darwin" ? "Meta+a" : "Control+a", "Backspace"]);
    expect(result).toEqual({ typed: 3, value: "new" });
});

test("supports Unicode code points without splitting surrogate pairs", async () => {
    const inserted: string[] = [];
    const ctx = { fns: {
        browser: {
            press: async () => ({ key: "ArrowRight" }),
            evaluate: async () => "✈️",
        },
        cdp: { scope: async (opts: any) => ({ ...opts, bound: false }), send: async ({ params }: any) => { inserted.push(params.text); return {}; } },
    } } as unknown as Context;

    const result = await typeText(ctx, null, { target: { css: "input" }, text: "✈️" });
    expect(inserted).toEqual(["✈", "️"]);
    expect(result.typed).toBe(2);
});
