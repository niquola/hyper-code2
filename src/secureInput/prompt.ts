// Ask the human for transient sensitive input in the browser UI. The value travels
// directly from a popup form to an in-memory Promise: never through the LLM,
// transcript, tool arguments/results, scratchpad, DB, logs, or filesystem.
/**
 * Prompts the user for transient sensitive input without exposing the value to the transcript.
 * With saveAs the typed value is encrypted into local secret storage and only the
 * secret://namespace/name reference is returned, so bash({ secrets }) and secrets.get
 * can reuse it later without the value ever reaching the model. One prompt at a time:
 * a call while another prompt is open or still closing in the UI throws.
 * @param opts.title Prompt title.
 * @param opts.name Optional prompt display name.
 * @param opts.message Optional explanatory prompt text.
 * @param opts.kind Input control kind.
 * @param opts.timeoutMs Maximum wait in milliseconds.
 * @param opts.maxlength Maximum accepted input length.
 * @param opts.saveAs Optional secret://namespace/name destination; when set the value is stored and the reference is returned instead of the value.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Prompt title. */
        title: string;
        /** Optional prompt display name. */
        name?: string;
        /** Optional explanatory prompt text. */
        message?: string;
        /** Input control kind. @default "password" */
        kind?: "otp" | "password" | "text";
        /** Maximum wait in milliseconds. @default 300000 @minimum 10000 @maximum 900000 */
        timeoutMs?: number;
        /** Maximum accepted input length. @minimum 1 @maximum 4096 */
        maxlength?: number;
        /** Optional secret://namespace/name destination; when set the value is stored and the reference is returned instead of the value. */
        saveAs?: string;
    },
): Promise<string> {
    const title = String(opts?.title ?? "").trim();
    if (!title) throw new Error("secureInput.prompt: title is required");
    const saveAs = opts.saveAs ? ctx.fns.secrets.parseRef({ ref: opts.saveAs }) : null;
    const name = String(opts?.name ?? `${title} · ${Bun.randomUUIDv7().slice(-8)}`).trim();
    const kind = opts.kind ?? "password";
    if (!["otp", "password", "text"].includes(kind)) throw new Error("secureInput.prompt: invalid kind");
    const timeoutMs = Math.max(10_000, Math.min(opts.timeoutMs ?? 300_000, 900_000));
    const secureState = ((ctx.state as any).secureInput ??= {});
    if (secureState.disabled) throw new Error("transient input prompts are disabled");
    const id = Bun.randomUUIDv7().replace(/[^a-zA-Z0-9]/g, "");
    const prompts = (secureState.prompts ??= new Map());

    // The browser has one modal host. Preserve the active prompt and reject a
    // newcomer; replacing the active capability makes Cancel look like a loop.
    if (prompts.size > 0) throw new Error("secure input prompt already active");
    // After an answer the modal is still on screen until the UI fetches
    // secureInput.current and sees nothing. Opening the next prompt inside that
    // window re-renders the form under the user's fingers and looks like the
    // same prompt reopening, so the caller gets an error instead of a queue.
    const closing = secureState.closing as { id: string; until: number } | undefined;
    if (closing && Date.now() < closing.until) throw new Error("previous secure input prompt is still closing in the UI; ask for one value per prompt and retry after it is closed");

    let resolve!: (value: string) => void;
    let reject!: (error: Error) => void;
    const answer = new Promise<string>((res, rej) => { resolve = res; reject = rej; });
    const maxlength = Math.max(1, Math.min(opts.maxlength ?? (kind === "otp" ? 16 : 256), 4096));
    const message = String(opts.message ?? "");
    prompts.set(id, { id, name, title, message, kind, maxlength, resolve, reject, createdAt: Date.now() });

    ctx.fns.procs.events.emit({ event: {
        type: "secure-input.prompt",
        id,
        name,
        title,
        message,
        kind,
        maxlength,
    } });

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const value = await Promise.race([
            answer,
            new Promise<string>((_, rej) => { timer = setTimeout(() => rej(new Error("transient input prompt timed out")), timeoutMs); }),
        ]);
        if (!saveAs) return value;
        const stored = await ctx.fns.secrets.set({ ref: opts.saveAs!, value, source: "secure-input" });
        return stored.ref;
    } finally {
        if (timer) clearTimeout(timer);
        prompts.delete(id);
        // Cleared by secureInput.current once a browser observed the closure;
        // the deadline only covers a page with no UI connected at all.
        secureState.closing = { id, until: Date.now() + 10_000 };
        ctx.fns.procs.events.emit({ event: { type: "secure-input.prompt.closed", id } });
    }
}
