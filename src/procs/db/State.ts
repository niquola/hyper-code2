// ctx.state.procs.db — the live Bun.SQL pool and its url, cached per ctx. A
// forked world (env.fork) gets its own, so a test never shares the dev pool.
import type { SQL } from "bun";
export type State = { sql?: SQL; url?: string };
