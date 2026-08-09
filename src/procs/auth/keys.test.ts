// UNIT test: procs/auth/keys.test.ts ↔ keys.ts — the run's signing key, and the
// one thing about it that is not obvious: two runs over one project must end up
// with the SAME key.
//
// They do share a directory. A manager restarting a workspace, a second start by
// hand, a crash and a respawn — any of those can put two processes on one
// WORKDIR for a moment, and both then find no key file and generate one. When
// the later write simply won, the earlier process kept a key nobody else had:
// the REPL token on disk no longer verified against the process that was serving
// (`repl needs this run's token`), and an agent could not open a page or remount
// the project it had just written.
import { test, expect } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testCtx } from "../../$test";

// What is asserted here is the invariant — every run's key IS the file's — not
// the collision itself: two starts inside one process do not reliably overlap in
// the window that used to break it. The fix is that the file is claimed with an
// exclusive open, so the run that loses the claim throws its own key away.
test("two runs over one project sign with the same key", async () => {
    const workdir = mkdtempSync(join(tmpdir(), "keys-"));
    const [a, b] = await Promise.all([testCtx({ workdir }), testCtx({ workdir })]);

    // Whichever of them claimed the file, the other imported it — so a token one
    // signs is a token the other accepts, which is the whole property.
    const token = await a.fns.procs.auth.sign({ sub: "repl", name: "repl", kind: "repl", days: 1 });
    expect((await b.fns.procs.auth.verify({ token }))?.kind).toBe("repl");

    const back = await b.fns.procs.auth.sign({ sub: "repl", name: "repl", kind: "repl", days: 1 });
    expect((await a.fns.procs.auth.verify({ token: back }))?.kind).toBe("repl");

    // …and a third run, starting later, joins the same key rather than a new one.
    const c = await testCtx({ workdir });
    expect((await c.fns.procs.auth.verify({ token }))?.kind).toBe("repl");

    // The file is the truth, so every run's key IS the file's — that is what a
    // client holding only the file can rely on.
    const onDisk = await Bun.file(join(workdir, ".runtime", "auth-key.json")).json();
    for (const run of [a, b, c]) {
        expect((run.state.procs.auth as any).keys.jwk.n).toBe(onDisk.public.n);
    }
});
