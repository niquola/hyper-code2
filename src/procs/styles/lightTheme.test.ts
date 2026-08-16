import { expect, test } from "bun:test";

const root = new URL("../../../", import.meta.url).pathname;

test("style builder has no external component framework plugin", async () => {
    const source = await Bun.file(`${root}src/procs/styles/build.ts`).text();
    expect(source).toContain('@plugin "@tailwindcss/typography"');
    expect(source).toContain('Tailwind and Typography provide utilities');
    expect(source).not.toContain('@plugin "daisy' + 'ui"');
});

test("app stylesheet leaves color scheme selection to the persisted document theme", async () => {
    const source = await Bun.file(`${root}src/procs/styles/$style_app.css`).text();
    expect(source).not.toContain("color-scheme: light");
});
