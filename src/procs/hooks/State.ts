// ctx.state.procs?.hooks — the extension points this process declares, and who answers
// them. A point is declared by a file (`$point_<name>.ts`) and answered by files
// (`$hook_<point>.ts`), so both halves are read off the tree like everything else.
export type State = {
    // point name → module that answers → its handler, in registration order.
    handlers?: Record<string, Map<string, Function>>;
    // point name → who declared it.
    points?: Record<string, { module: string; rel: string; doc?: any; family?: boolean }>;
};
