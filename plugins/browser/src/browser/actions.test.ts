import { expect, test } from "bun:test";
import click from "./click";
import fill from "./fill";
import press from "./press";
import select from "./select";
import check from "./check";
import hover from "./hover";
import scroll from "./scroll";

function context(value: unknown = undefined, ok = true) {
    const calls: any[] = [];
    const ctx = { fns: { browser: {
        act: async (opts: any) => {
            calls.push(opts);
            return ok
                ? { ok: true, completed: opts.actions.length, results: opts.actions.map((action: any, index: number) => ({ index, kind: action.kind, value })) }
                : { ok: false, completed: 0, results: [], failed: { code: "TARGET_NOT_FOUND", message: "missing" } };
        },
    } } } as unknown as Context;
    return { ctx, calls };
}

test("click keeps the legacy selector contract", async () => {
    const { ctx, calls } = context({ clicked: true });
    expect(await click(ctx, null, { selector: "#save", session: "page" })).toBe(true);
    expect(calls[0].actions).toEqual([{ kind: "click", target: { css: "#save" }, button: undefined, count: undefined }]);
});

test("fill batches fields without submitting", async () => {
    const { ctx, calls } = context({ value: "ok" });
    const result = await fill(ctx, null, { fields: [
        { target: { css: "#a" }, value: "one" },
        { target: { ref: "r1e2" }, value: "two" },
    ] });
    expect(result.filled).toBe(2);
    expect(calls[0].actions.map((action: any) => action.kind)).toEqual(["fill", "fill"]);
});

test("precise action wrappers map to one shared engine", async () => {
    const pressCtx = context({ key: "Tab" });
    await press(pressCtx.ctx, null, { key: "Tab", target: { css: "input" } });
    expect(pressCtx.calls[0].actions[0]).toEqual({ kind: "press", key: "Tab", target: { css: "input" } });

    const selectCtx = context({ values: ["pt"] });
    expect(await select(selectCtx.ctx, null, { target: { css: "select" }, values: ["pt"] })).toEqual({ values: ["pt"] });

    const checkCtx = context({ checked: true });
    expect(await check(checkCtx.ctx, null, { target: { css: "#agree" }, value: true })).toEqual({ checked: true });

    const hoverCtx = context({ hovered: true, x: 1, y: 2 });
    expect(await hover(hoverCtx.ctx, null, { target: { text: "Menu" } })).toEqual({ hovered: true, x: 1, y: 2 });

    const scrollCtx = context({ x: 0, y: 400 });
    expect(await scroll(scrollCtx.ctx, null, { dy: 400 })).toEqual({ x: 0, y: 400 });
});

test("wrappers throw structured action failures", async () => {
    const { ctx } = context(undefined, false);
    await expect(click(ctx, null, { target: { css: "#missing" } })).rejects.toThrow(/TARGET_NOT_FOUND/);
});
