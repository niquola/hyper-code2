// Builds .hyper/bundle.js from src/ui/bundle.entry.ts.
// Run manually: `bun script/build-bundle.ts`.
// Served via GET /bundle.js (src/ui/$route_bundle_GET.ts).
import { mkdir } from "node:fs/promises";

await mkdir(".hyper", { recursive: true });
const t0 = performance.now();
const out = await Bun.build({
    entrypoints: ["src/ui/bundle.entry.ts"],
    outdir: ".hyper",
    naming: "bundle.js",
    target: "browser",
    format: "iife",
    minify: true,
    sourcemap: "none",
});
const ms = Math.round(performance.now() - t0);

if (!out.success) {
    for (const log of out.logs) console.error(log);
    process.exit(1);
}
const f = out.outputs[0]!;
const size = (await Bun.file(f.path).arrayBuffer()).byteLength;
console.log(`[bundle] ${f.path} · ${(size / 1024).toFixed(1)} KB · ${ms}ms`);
