// ctx.state.procs.db — the open connection, cached per ctx. A forked world
// (env.fork) gets its own, which is what keeps a test's :memory: db and dev's
// file db from ever touching.
import type { Database } from "bun:sqlite";
export type State = { connection?: Database };
