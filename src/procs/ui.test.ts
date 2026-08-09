// FUNCTIONAL test: src/ui.test.ts ↔ the src/ui/ namespace — and the one rule
// that makes a page drivable at all. The workspace shows module pages to the
// user by pointing at their data-* markers; a page without them is a page the
// agent cannot show anyone, so this is checked for every mounted tab rather
// than left to whoever wrote it.
import { test, expect } from "bun:test";
import { testCtx } from "../$test";

const ctx = await testCtx();

// Every renderer in the repo aliases this one function, so its exact behaviour —
// including what a missing value prints — is load-bearing in ~110 files.
test("escape covers the five characters, and a missing value is empty", () => {
    expect(ctx.fns.procs.ui.escape({ text: `<a href="x">O'Brien & co</a>` }))
        .toBe("&lt;a href=&quot;x&quot;&gt;O&#39;Brien &amp; co&lt;/a&gt;");
    expect(ctx.fns.procs.ui.escape({ text: undefined })).toBe("");
    expect(ctx.fns.procs.ui.escape({ text: null })).toBe("");
    expect(ctx.fns.procs.ui.escape({ text: 0 })).toBe("0");
});

test("attr emits the markers, drops the empty ones and escapes values", () => {
    expect(ctx.fns.procs.ui.attr({ entity: "file", id: "src/a.ts" })).toBe(`data-entity="file" data-id="src/a.ts"`);
    expect(ctx.fns.procs.ui.attr({ entity: "file", id: undefined, status: "" })).toBe(`data-entity="file"`);
    expect(ctx.fns.procs.ui.attr({ id: `a"b` })).toBe(`data-id="a&quot;b"`);
});

// A layout hardcodes the framework's own asset urls as strings, which nothing
// type-checks — so when the framework moved under /procs they silently kept
// pointing at the old paths and the shell served 404s for htmx and the event
// stream. Pin the layout to the route table.
test("every path the default layout hardcodes is a route that exists", () => {
    const html = ctx.fns.procs.ui.layout({ main: "" });
    const paths = [
        ...html.matchAll(/<script src="(\/[^"?#]*)"/g),
        ...html.matchAll(/<link [^>]*href="(\/[^"?#]*)"/g),
    ].map(m => m[1]!);
    const missing = [...new Set(paths)].filter(p => !ctx.fns.procs.http.match({ method: "GET", pathname: p }));
    expect(missing).toEqual([]);
});

test("the components carry the markers, so a page built from them cannot forget", () => {
    const html = ctx.fns.procs.ui.page({
        page: "demo",
        title: "Demo",
        main: ctx.fns.procs.ui.box({
            title: "1 item",
            right: ctx.fns.procs.ui.button({ action: "refresh", label: "Refresh", get: "/x" }),
            body: ctx.fns.procs.ui.row({ entity: "thing", id: "one", status: "draft", href: "/x", cells: [{ role: "name", text: "One" }] })
                + ctx.fns.procs.ui.form({ form: "search", get: "/x", body: ctx.fns.procs.ui.field({ name: "q" }) }),
        }),
    });
    expect(html.match(/data-[a-z]+="[^"]*"/g)).toEqual([
        `data-page="demo"`, `data-action="refresh"`,
        `data-entity="thing"`, `data-id="one"`, `data-status="draft"`, `data-role="name"`,
        `data-form="search"`, `data-field="q"`,
    ]);
});

