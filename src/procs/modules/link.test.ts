// FUNCTIONAL test: link.ts / unlink.ts — turning a plugin on hands it to BOTH
// readers of the same directory.
//
// A module is a folder the host mounts by its `procs` manifest; a skill is the
// same folder the coding agent reads by its SKILL.md. Turning one on for a
// project used to tell only the host, and the agent working in that project
// never learned the tool existed.
import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, lstatSync, readlinkSync, realpathSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testCtx } from "../../$test";

const ctx = await testCtx();

// A project to link into, and a container to link into it.
function scene() {
    const workdir = mkdtempSync(join(tmpdir(), "link-"));
    const home = mkdtempSync(join(tmpdir(), "catalogue-"));
    const folder = join(home, "vitals");
    mkdirSync(join(folder, "src", "vitals"), { recursive: true });
    writeFileSync(join(folder, "package.json"), JSON.stringify({ name: "vitals", procs: { src: "src", plugin: true } }));
    writeFileSync(join(folder, "SKILL.md"), "# Vitals\n");
    const at = join(workdir, ".claude", "skills", "vitals");
    return { workdir, folder, at, run: ctx.fns.procs.env.fork({ mode: "test", env: { ...ctx.env, WORKDIR: workdir } }) };
}

test("turning a plugin on links its folder into the project's skills", async () => {
    const { folder, at, run } = scene();

    expect(await run.fns.procs.modules.link({ name: "vitals", folder })).toEqual({ linked: at });
    expect(lstatSync(at).isSymbolicLink()).toBe(true);
    expect(readlinkSync(at)).toBe(folder);
    // …and what the agent reads is at the end of it.
    expect(existsSync(join(at, "SKILL.md"))).toBe(true);

    // Linking again is the same link, not a second one.
    expect(await run.fns.procs.modules.link({ name: "vitals", folder })).toEqual({ linked: at });

    // Turning it off takes the link away and leaves the container alone.
    expect(await run.fns.procs.modules.unlink({ name: "vitals" })).toEqual({ unlinked: true });
    expect(existsSync(at)).toBe(false);
    expect(existsSync(join(folder, "SKILL.md"))).toBe(true);
});

test("a skill the project wrote itself is never replaced", async () => {
    const { folder, at, run } = scene();
    mkdirSync(at, { recursive: true });
    writeFileSync(join(at, "SKILL.md"), "# the project's own\n");

    const answer = await run.fns.procs.modules.link({ name: "vitals", folder });
    expect(answer.linked).toBe(null);
    expect(answer.why).toContain("project's own");
    expect(await Bun.file(join(at, "SKILL.md")).text()).toContain("the project's own");

    // …and un-asking for the module does not delete it either.
    expect(await run.fns.procs.modules.unlink({ name: "vitals" })).toEqual({ unlinked: false });
    expect(existsSync(join(at, "SKILL.md"))).toBe(true);
});

// Linking on `modules.add` covers one moment in one process. A fresh clone, a
// hand-edited workspace.json, a plugin that arrived with a git pull — those all
// leave the host mounting a tool the agent has never heard of, which is why the
// links are reconciled at boot instead.
test("boot links every mounted plugin, and takes away the links that went stale", async () => {
    const { workdir, folder, at, run } = scene();

    // A stale link of ours: it points at a container nothing mounts.
    const gone = mkdtempSync(join(tmpdir(), "gone-"));
    mkdirSync(join(gone, "src"), { recursive: true });
    writeFileSync(join(gone, "package.json"), JSON.stringify({ name: "old", procs: { src: "src", plugin: true } }));
    mkdirSync(join(workdir, ".claude", "skills"), { recursive: true });
    symlinkSync(gone, join(workdir, ".claude", "skills", "old"), "dir");

    // …and something the project wrote itself, which is not ours to touch.
    mkdirSync(join(workdir, ".claude", "skills", "mine"), { recursive: true });
    writeFileSync(join(workdir, ".claude", "skills", "mine", "SKILL.md"), "# mine\n");

    // Stand in for the mount table: one module with a SKILL.md, and one without.
    // Shipping a SKILL.md IS the declaration "I am a tool for the agent" — being
    // turned on by a project is not, which is how the host's own tools (git,
    // the kit catalogue, the workbench screens) went unlinked and unseen.
    const quiet = mkdtempSync(join(tmpdir(), "quiet-"));
    mkdirSync(join(quiet, "src"), { recursive: true });
    writeFileSync(join(quiet, "package.json"), JSON.stringify({ name: "quiet", procs: { src: "src" } }));
    run.state.procs.modules = [
        { name: "vitals", dir: join(folder, "src"), plugin: true, namespaces: ["vitals"] } as any,
        { name: "quiet", dir: join(quiet, "src"), plugin: false, namespaces: ["quiet"] } as any,
    ];
    const done = await run.fns.procs.modules.linkAll({});

    expect(done.linked).toEqual(["vitals"]);      // …and not "quiet": no SKILL.md, nothing for an agent to read
    expect(readlinkSync(at)).toBe(folder);
    expect(done.dropped).toEqual(["old"]);
    expect(existsSync(join(workdir, ".claude", "skills", "old"))).toBe(false);
    expect(existsSync(join(workdir, ".claude", "skills", "mine", "SKILL.md"))).toBe(true);
});

// The link is written into `.claude/skills`, and `.claude/skills` is itself a
// plugin path: without a guard, every plugin turned on was then discovered a
// SECOND time through its own link — two records, two tabs, one directory.
test("a plugin linked into the project is not discovered again through its link", async () => {
    const { workdir, folder, run } = scene();
    await run.fns.procs.modules.link({ name: "vitals", folder });

    const roots = await run.fns.procs.modules.discover({});
    const vitals = roots.filter((r: any) => r.name === "vitals");
    expect(vitals.length).toBeLessThanOrEqual(1);
    // …and if it is there at all, it is the real folder, not the link.
    if (vitals[0]) expect(vitals[0].folder).toBe(folder);
    expect(workdir).toBeTruthy();
});

// …and every tool the host HAS, not only the ones this project turned on. A
// module is off because its routes and functions are not wanted here — never
// because the agent should be unable to read that it exists, and "turn it on" is
// a line in workspace.json it can only propose if it knows the name.
//
// The line is between the host's own library and the machine's skill folders:
// the first is ours to offer, the second is the user's own and already visible
// to their agent from their home, so it must not be adopted into the project.
test("boot links the catalogue the host ships, and never the machine's own skills", async () => {
    const { workdir, run: base } = scene();

    // The host's library: one module with a SKILL.md, on the module path.
    const library = mkdtempSync(join(tmpdir(), "libs-"));
    const offered = join(library, "charts");
    mkdirSync(join(offered, "src", "charts"), { recursive: true });
    writeFileSync(join(offered, "package.json"), JSON.stringify({ name: "charts", procs: { src: "src", optional: true } }));
    writeFileSync(join(offered, "SKILL.md"), "# Charts\n");

    // The machine's: same shape, on a plugin path.
    const home = mkdtempSync(join(tmpdir(), "home-skills-"));
    const personal = join(home, "undermind");
    mkdirSync(join(personal, "src", "undermind"), { recursive: true });
    writeFileSync(join(personal, "package.json"), JSON.stringify({ name: "undermind", procs: { src: "src", optional: true } }));
    writeFileSync(join(personal, "SKILL.md"), "# Undermind\n");

    const run = base.fns.procs.env.fork({ mode: "test", env: { ...base.env, WORKDIR: workdir, PROCS_PATH: library, PROCS_PLUGINS: home } });
    run.state.procs.modules = [];                                  // nothing mounted: the catalogue is the whole answer
    const done = await run.fns.procs.modules.linkAll({});

    expect(done.linked).toEqual(["charts"]);
    // realpath: `modules.paths` resolves its search dirs, and on macOS /var is a link to /private/var.
    expect(readlinkSync(join(workdir, ".claude", "skills", "charts"))).toBe(realpathSync(offered));
    expect(existsSync(join(workdir, ".claude", "skills", "undermind"))).toBe(false);
});
