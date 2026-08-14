// Ask the human for transient sensitive input in the browser UI. The value travels
// directly from a popup form to an in-memory Promise: never through the LLM,
// transcript, tool arguments/results, scratchpad, DB, logs, or filesystem.
/**
 * Prompts the user for transient sensitive input without exposing the value to the transcript.
 * @param opts.title Prompt title.
 * @param opts.name Optional prompt display name.
 * @param opts.message Optional explanatory prompt text.
 * @param opts.kind Input control kind.
 * @param opts.timeoutMs Maximum wait in milliseconds.
 * @param opts.maxlength Maximum accepted input length.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        title: string;
        name?: string;
        message?: string;
        kind?: "otp" | "password" | "text";
        timeoutMs?: number;
        maxlength?: number;
    },
): Promise<string> {
    const title = String(opts?.title ?? "").trim();
    if (!title) throw new Error("secureInput.prompt: title is required");
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
        return await Promise.race([
            answer,
            new Promise<string>((_, rej) => { timer = setTimeout(() => rej(new Error("transient input prompt timed out")), timeoutMs); }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
        prompts.delete(id);
        ctx.fns.procs.events.emit({ event: { type: "secure-input.prompt.closed", id } });
    }
}
