// Per-call context: created per HTTP request (req, params) or per REPL eval.
// Mutable — interceptors/handlers may attach user, locale, etc.
export type Session = {
    req?: Request;
    // Where this call came from, minted once per request/eval and shared by every
    // line logged inside it. `kind` says which door it came through.
    trace?: { id: string; started: number; route?: string };
    params?: Record<string, string>;
    kind?: string;
    [key: string]: any;
};
