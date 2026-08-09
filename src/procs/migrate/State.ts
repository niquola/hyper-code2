// ctx.state.procs?.migrate — the migrations collected from `$migration_<id>.ts`, in the
// order they will run. Applied (and recorded) by migrate.up, not by the loader.
export type State = { list?: Array<{ id: string; up: Function; down?: Function }> };
