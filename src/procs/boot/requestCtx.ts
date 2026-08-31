// A per-request Context — split out of `$main.ts` so nothing inside the
// framework has to import the entry point.
//
// It used to live in `$main.ts`, and `procs/http/$start.ts` imported it from
// there. That closed a cycle: `$main` → `boot/load` → every file → `$start` →
// `$main`. Bun resolved it until 1.4.0 and then stopped: boot spun at 100% CPU
// with no output, because the import of `$start` never returned. A leaf module
// cannot deadlock, which is why this one has no imports of its own.
export function makeRequestCtx(base: Context, session: Session): Context {
    const c: any = Object.create(base);
    // Every call that happens inside this one shares a trace: the session is
    // already carried down every `ctx.fns.*` call, so a log line written five
    // frames deep says which request it belongs to without anyone passing it.
    session.trace ??= { id: crypto.randomUUID().slice(0, 8), started: Date.now(), route: (session as any).route };
    c.session = session;
    return c as Context;
}
