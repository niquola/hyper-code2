import { test, expect } from "bun:test";
import { testCtx } from "../../$test";

const ctx = await testCtx();

test("classify: nested fn → moduleDir + runtimeName", () => {
    expect(ctx.fns.procs.project.classify({ rel: "billing/invoices/create.ts" }))
        .toMatchObject({ kind: "fn", moduleDir: "billing/invoices", runtimeName: "create" });
});

test("classify: root $name.ts → fn at root", () => {
    expect(ctx.fns.procs.project.classify({ rel: "layout.ts" }))
        .toMatchObject({ kind: "fn", moduleDir: ".", runtimeName: "layout" });
});

test("classify: route path (_ → /, $id → :id)", () => {
    expect(ctx.fns.procs.project.classify({ rel: "todo/$route_$id_edit_GET.ts" }))
        .toMatchObject({ kind: "route", routePath: "/todo/:id/edit", method: "GET" });
});

test("classify: types and .test.ts are not registered", () => {
    expect(ctx.fns.procs.project.classify({ rel: "billing/Invoice.ts" }).kind).toBe("type");
    expect(ctx.fns.procs.project.classify({ rel: "billing/$type_Invoice.ts" }).kind).toBe("type");
    expect(ctx.fns.procs.project.classify({ rel: "billing/add.test.ts" }).kind).toBe("skip");
});
