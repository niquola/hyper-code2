export type Context = RootFns & {
    env: Record<string, string | undefined>;
    state: Record<string, any>;
    routes: Record<string, Record<string, Function>>;
    fns: FnsRegistry;
};
