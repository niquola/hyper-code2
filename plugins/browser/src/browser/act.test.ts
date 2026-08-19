import { expect, test } from "bun:test";
import act from "./act";

function fakeContext(options: { ambiguous?: boolean; fillFails?: boolean } = {}) {
    const methods: string[] = [];
    const ctx = {
        state: {},
        fns: {
            browser: {
                evaluate: async () => ({ url: "https://example.test", title: "Example" }),
            },
            cdp: {
                send: async ({ method, params }: any) => {
                    methods.push(method);
                    if (method === "Runtime.evaluate") {
                        if (options.ambiguous) return { exceptionDetails: { exception: { description: "Error: TARGET_AMBIGUOUS: 2 matches" } } };
                        return { result: { objectId: "object-1" } };
                    }
                    if (method === "Runtime.callFunctionOn") {
                        const source = String(params.functionDeclaration || "");
                        if (source.includes("el.isConnected")) return { result: { value: { ok: true, x: 10, y: 20, tag: "button" } } };
                        if (source.includes("const el = this")) {
                            if (options.fillFails) return { exceptionDetails: { exception: { description: "Error: INVALID_FILL_TARGET: use select" } } };
                            return { result: { value: { value: params.arguments?.[0]?.value } } };
                        }
                        return { result: { value: {} } };
                    }
                    return {};
                },
            },
        },
    } as unknown as Context;
    return { ctx, methods };
}

test("executes click and fill sequentially", async () => {
    const { ctx, methods } = fakeContext();
    const result = await act(ctx, null, {
        session: "page",
        actions: [
            { kind: "click", target: { css: "#open" } },
            { kind: "fill", target: { css: "#email" }, value: "a@example.test" },
        ],
    });
    expect(result.ok).toBe(true);
    expect(result.completed).toBe(2);
    expect(result.results[1].value).toEqual({ value: "a@example.test" });
    expect(methods.filter(method => method === "Input.dispatchMouseEvent")).toHaveLength(3);
});

test("batch stops at the first failure and reports partial progress", async () => {
    const { ctx } = fakeContext({ fillFails: true });
    const result = await act(ctx, null, {
        actions: [
            { kind: "click", target: { css: "#open" } },
            { kind: "fill", target: { css: "#bad" }, value: "x" },
            { kind: "click", target: { css: "#never" } },
        ],
    });
    expect(result.ok).toBe(false);
    expect(result.completed).toBe(1);
    expect(result.failed).toMatchObject({ index: 1, kind: "fill", code: "INVALID_FILL_TARGET", retryable: false });
});

test("ambiguous targets fail without choosing the first match", async () => {
    const { ctx } = fakeContext({ ambiguous: true });
    const result = await act(ctx, null, { actions: [{ kind: "click", target: { css: ".duplicate" } }] });
    expect(result.ok).toBe(false);
    expect(result.failed).toMatchObject({ code: "TARGET_AMBIGUOUS", retryable: false });
});

test("stale snapshot refs return a recovery hint", async () => {
    const { ctx } = fakeContext();
    const result = await act(ctx, null, { session: "page", actions: [{ kind: "click", target: { ref: "r9e2" } }] });
    expect(result.ok).toBe(false);
    expect(result.failed).toMatchObject({ code: "STALE_REF", retryable: false, hint: "capture a new interactive snapshot" });
});



test("CSS resolution filters hidden duplicate controls before strict matching", async () => {
    let expression = "";
    const { ctx } = fakeContext();
    (ctx.fns.cdp.send as any) = async ({ method, params }: any) => {
        if (method === "Runtime.evaluate") { expression = params.expression; return { result: { objectId: "object-1" } }; }
        if (method === "Runtime.callFunctionOn") return { result: { value: { ok: true, x: 10, y: 20, tag: "input" } } };
        return {};
    };
    const result = await act(ctx, null, { actions: [{ kind: "hover", target: { css: "input[type=email]" } }] });
    expect(result.ok).toBe(true);
    expect(expression).toContain("all.filter(el => visible(el)");
});
test("Tab uses a focus traversal fallback when CDP leaves focus unchanged", async () => {
    const expressions: string[] = [];
    let tabRemembered = false;
    const { ctx } = fakeContext();
    (ctx.fns.browser.evaluate as any) = async ({ expression }: any) => {
        expressions.push(expression);
        if (expression.includes("__browserActTabFocus =")) { tabRemembered = true; return true; }
        if (expression.includes("const before = root.__browserActTabFocus")) return { moved: true, tag: "input", id: "password", label: "pass" };
        return { url: "https://example.test", title: "Example" };
    };
    const result = await act(ctx, null, { actions: [{ kind: "press", key: "Tab" }] });
    expect(result.ok).toBe(true);
    expect(tabRemembered).toBe(true);
    expect(result.results[0].value).toEqual({ key: "Tab", focus: { moved: true, tag: "input", id: "password", label: "pass" } });
    expect(expressions.some(expression => expression.includes("querySelectorAll(selector)"))).toBe(true);
});


test("check supports visually hidden native controls idempotently", async () => {
    const calls: string[] = [];
    const { ctx } = fakeContext();
    (ctx.fns.cdp.send as any) = async ({ method, params }: any) => {
        calls.push(method);
        if (method === "Runtime.evaluate") return { result: { objectId: "checkbox-1" } };
        if (method === "Runtime.callFunctionOn") {
            const source = String(params.functionDeclaration || "");
            if (source.includes("el.isConnected")) return { result: { value: { ok: true, x: 10, y: 20, tag: "input" } } };
            if (source.includes("visuallyHidden:")) return { result: { value: { checked: false, desired: true, visuallyHidden: true } } };
            if (source.includes("HTMLInputElement.prototype")) return { result: { value: { checked: true } } };
            if (source.includes("Boolean(this.checked)")) return { result: { value: { checked: true } } };
        }
        return {};
    };
    const result = await act(ctx, null, { actions: [{ kind: "check", target: { css: "#hidden-checkbox" }, value: true }] });
    expect(result.ok).toBe(true);
    expect(result.results[0].value).toEqual({ checked: true });
    expect(calls.filter(method => method === "Input.dispatchMouseEvent")).toHaveLength(0);
});


test("rejects empty batches", async () => {
    await expect(act(fakeContext().ctx, null, { actions: [] })).rejects.toThrow(/non-empty/);
});
