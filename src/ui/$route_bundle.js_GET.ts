// GET /ui/bundle.js — serves the built client bundle (.hyper/bundle.js).
// Build it with: `bun script/build-bundle.ts`.
export default async function () {
    const f = Bun.file(".hyper/bundle.js");
    if (!(await f.exists())) {
        return new Response(
            `// bundle missing — run: bun script/build-bundle.ts`,
            { status: 404, headers: { "content-type": "application/javascript" } },
        );
    }
    return new Response(f, {
        headers: {
            "content-type": "application/javascript",
            "cache-control": "public, max-age=0, must-revalidate",
        },
    });
}
