// ctx.state.procs?.http — the table a request is matched against, what runs before it,
// and the running server. Rebuilt and swapped atomically by http.loadRoutes.
export type State = {
    routes: Record<string, Record<string, Function>>;
    middleware?: Array<{ prefix: string; segs: string[]; handler: Function }>;
    server?: { server: any; port: number };
    logFile?: any;
};
