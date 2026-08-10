// Per-ctx state. A module's state lives under the module's own name and is typed
// by its `State.ts` (genTypes merges those into this interface), so where a
// module keeps its state is never a question. The keys below are the core's own,
// which belongs to no module. The registry is here (the ctx.fns
// Proxy reads it), so a derived ctx (request / env.fork) carrying its own state
// stays self-consistent.
declare global {
    // Config schema (context-clj style): per-param type + rules. A module declares
    // one in `module/$config.ts`; ctx.fns.procs.config.resolve coerces + validates the
    // values that come from package.json proc.prod.<module> and env vars.
    type ConfigParam = {
        type: "string" | "string[]" | "integer" | "number" | "boolean" | "map";
        required?: boolean;
        default?: any;
        env?: string;            // explicit env var name (default: <MODULE>__<KEY>)
        sensitive?: boolean;
        validator?: (v: any) => boolean;
    };
    type ConfigSchema = Record<string, ConfigParam>;
    type ConfigValue<T> =
        T extends "string" ? string :
        T extends "string[]" ? string[] :
        T extends "integer" | "number" ? number :
        T extends "boolean" ? boolean :
        T extends "map" ? Record<string, any> : unknown;
    // Derives the typed config object from a schema: ConfigOf<typeof schema>.
    type ConfigOf<S extends ConfigSchema> = { [K in keyof S]: ConfigValue<S[K]["type"]> };

    // What a function knows about itself. The fn loader puts this on the function
    // object (functions are objects — this is our var metadata), and `ctx.fns`
    // calls with `this` = the function, so a NON-ARROW function can read it:
    //     export default function (this: Self, ctx: Context, ...) {
    //         ctx.fns.procs.log.info({ msg: `hello from ${this.meta.name}` });
    //     }
    type Meta = { name: string; module: string; fn: string; rel: string; abs: string; doc: string };
    type Self = { meta: Meta };

    interface CtxState {
        registry: Record<string, any>;
        root?: string;              // project/app root (package.json + src live here)
        serverStart?: number;
        http: types.procs.http.State;
        lifecycle?: { started: string[] };
        cli?: Record<string, Function>;
        dev?: { errors: Map<string, string> };
        watcher?: any;
        db?: unknown;   // legacy slot; storage is Postgres (ctx.state.procs.db.sql)
        [key: string]: any;
    }
}

// Every function in the project has the signature:
//     export default async function (ctx: Context, session: Session, opts: {...}) {...}
// When called through ctx.fns.* / ctx.<rootFn>, `ctx` and `session` are
// injected implicitly — callers pass only opts:
//     ctx.fns.notes.add({ text: "hi" })
// Raw functions live in ctx.state.registry; ctx.fns is an injecting Proxy
// (see $main.ts makeCtx). Per-request ctx = makeRequestCtx(rootCtx, session),
// so the session flows through the whole call chain automatically.
export type Context = {
    env: Record<string, string | undefined>;
    state: CtxState;
    session: Session | null;
    fns: FnsRegistry;
};
