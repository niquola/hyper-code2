import { expect, test } from "bun:test";
import act from "./act";

function context(options: Array<{ value: string; label: string }>, multiple = false) {
    let selected: string[] = [];
    const ctx = { state: {}, fns: {
        browser: { evaluate: async () => ({ url: "https://form.test", title: "Form" }) },
        cdp: { send: async ({ method, params }: any) => {
            if (method === "Runtime.evaluate") return { result: { objectId: "select-1" } };
            if (method === "Runtime.callFunctionOn") {
                const source = String(params.functionDeclaration || "");
                if (source.includes("el.isConnected")) return { result: { value: { ok: true, x: 10, y: 10, tag: "select" } } };
                if (source.includes("HTMLSelectElement")) {
                    const requested: string[] = params.arguments[0].value;
                    const matched = requested.flatMap(item => options.filter(option => option.value === item || option.label === item).map(option => option.value));
                    const missing = requested.filter(item => !options.some(option => option.value === item || option.label === item));
                    if (missing.length) return { exceptionDetails: { exception: { description: `Error: OPTION_NOT_FOUND: ${missing.join(", ")}` } } };
                    if (!multiple && matched.length > 1) return { exceptionDetails: { exception: { description: "Error: INVALID_SELECT_VALUE: single-select accepts one value" } } };
                    selected = matched;
                    return { result: { value: { values: selected } } };
                }
            }
            return {};
        } },
    } } as unknown as Context;
    return { ctx, selected: () => selected };
}

test("select matches a native option by visible label", async () => {
    const { ctx, selected } = context([{ value: "pt", label: "Portugal" }, { value: "dk", label: "Denmark" }]);
    const result = await act(ctx, null, { actions: [{ kind: "select", target: { css: "#country" }, values: ["Denmark"] }] });
    expect(result.ok).toBe(true);
    expect(selected()).toEqual(["dk"]);
    expect(result.results[0].value).toEqual({ values: ["dk"] });
});

test("select reports missing options explicitly", async () => {
    const { ctx } = context([{ value: "pt", label: "Portugal" }]);
    const result = await act(ctx, null, { actions: [{ kind: "select", target: { css: "#country" }, values: ["Denmark"] }] });
    expect(result.ok).toBe(false);
    expect(result.failed).toMatchObject({ code: "OPTION_NOT_FOUND", retryable: false });
});
