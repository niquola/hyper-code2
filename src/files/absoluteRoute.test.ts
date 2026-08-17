import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";
import { join } from "node:path";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";

describe("GET /files/absolute — path-based Files URLs", () => {
    test("renders a Markdown page and lets a relative image resolve as raw bytes", async () => {
        const ctx = await mkTestCtx();
        const dir = await mkdtemp(join(tmpdir(), "hyper-files-absolute-"));
        try {
            await mkdir(join(dir, "images"));
            await writeFile(join(dir, "readme.md"), "# Page\n\n![diagram](./images/diagram.png)\n");
            const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
            await writeFile(join(dir, "images", "diagram.png"), bytes);
            await ctx.fns.procs.http.loadRoutes({});

            const pageUrl = await ctx.fns.files.browserUrl({ path: join(dir, "readme.md") });
            const page = await ctx.fns.procs.http.dispatch({ url: pageUrl, headers: { accept: "text/html" } });
            const html = await page.text();
            expect(page.status).toBe(200);
            expect(html).toContain("diagram.png");

            const image = await ctx.fns.procs.http.dispatch({
                url: new URL("./images/diagram.png", "http://localhost" + pageUrl).pathname,
                headers: { accept: "image/avif,image/webp,image/png,image/*,*/*;q=0.8" },
            });
            expect(image.status).toBe(200);
            expect(image.headers.get("content-type")).toBe("image/png");
            expect(new Uint8Array(await image.arrayBuffer())).toEqual(bytes);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    test("opens relative Markdown links as Files pages", async () => {
        const ctx = await mkTestCtx();
        const dir = await mkdtemp(join(tmpdir(), "hyper-files-absolute-"));
        try {
            await writeFile(join(dir, "one.md"), "[next](./two.md)");
            await writeFile(join(dir, "two.md"), "# Two");
            await ctx.fns.procs.http.loadRoutes({});
            const one = await ctx.fns.files.browserUrl({ path: join(dir, "one.md") });
            const two = new URL("./two.md", "http://localhost" + one).pathname;
            const response = await ctx.fns.procs.http.dispatch({ url: two, headers: { accept: "text/html" } });
            expect(response.status).toBe(200);
            expect(await response.text()).toContain("Two");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
