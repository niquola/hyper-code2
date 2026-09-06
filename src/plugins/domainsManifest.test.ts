import { expect, test } from "bun:test";
import discover from "../procs/modules/discover";
import { resolve } from "node:path";

test("official domains manifests parse and survive real module discovery", async () => {
    const root = resolve(import.meta.dir, "../..");
    for (const name of ['arxiv','gh','google','youtube','zulip']) {
        const manifest = await Bun.file(`${root}/plugins/${name}/package.json`).json();
        expect(manifest.procs.domains.length).toBeGreaterThan(0);
    }
    const ctx: any = {env:{PROCS_PLUGINS:`${root}/plugins`,USER_PLUGINS:''},state:{root}};
    const roots = await discover(ctx,null,{});
    expect(roots.find(p=>p.name==='youtube')?.domains).toContain('www.youtube.com');
    expect(roots.find(p=>p.name==='google')?.domains).toContain('docs.google.com');
});
