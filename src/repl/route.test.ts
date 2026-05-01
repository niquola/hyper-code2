import { test, expect, describe } from "bun:test";
import route from "./$route__POST";
import evalFn from "./eval";

const mkCtx = () => ({ fns: { repl: { eval: evalFn } } }) as unknown as Context;

describe("POST /repl", () => {
    test("returns { success, result } on valid code", async () => {
        const req = new Request("http://x/repl", { method: "POST", body: "console.log(1 + 1)" });
        const res = await route(mkCtx(), null, req);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ success: true, result: "2" });
    });

    test("returns 500 + error/stack on throw", async () => {
        const req = new Request("http://x/repl", { method: "POST", body: "nope.boom()" });
        const res = await route(mkCtx(), null, req);
        expect(res.status).toBe(500);
        const body = await res.json() as any;
        expect(body.error).toMatch(/not defined/);
        expect(body.stack).toBeTypeOf("string");
    });
});
