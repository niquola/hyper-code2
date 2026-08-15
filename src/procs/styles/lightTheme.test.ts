import { expect, test } from "bun:test";

const root = new URL("../../../", import.meta.url).pathname;

test("style builder ships explicit daisyUI light and dark themes", async () => {
    const source = await Bun.file(`${root}src/procs/styles/build.ts`).text();
    expect(source).toContain("themes: light --default, dark;");
    expect(source).not.toContain("dark --prefersdark");
});

test("app stylesheet leaves color scheme selection to the persisted document theme", async () => {
    const source = await Bun.file(`${root}src/procs/styles/$style_app.css`).text();
    expect(source).not.toContain("color-scheme: light");
});
