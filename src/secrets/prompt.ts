// Ask the human for a transient secret in the browser UI. The value travels
// directly from a popup form to an in-memory Promise: never through the LLM,
// transcript, tool arguments/results, scratchpad, DB, logs, or filesystem.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        title: string;
        message?: string;
        kind?: "otp" | "password" | "text";
        timeoutMs?: number;
        maxlength?: number;
    },
): Promise<string> {
    const title = String(opts?.title ?? "").trim();
    if (!title) throw new Error("secrets.prompt: title is required");
    const kind = opts.kind ?? "password";
    if (!["otp", "password", "text"].includes(kind)) throw new Error("secrets.prompt: invalid kind");
    const timeoutMs = Math.max(10_000, Math.min(opts.timeoutMs ?? 300_000, 900_000));
    const id = Bun.randomUUIDv7().replace(/[^a-zA-Z0-9]/g, "");
    const prompts = (((ctx.state as any).secrets ??= {}).prompts ??= new Map());

    let resolve!: (value: string) => void;
    let reject!: (error: Error) => void;
    const answer = new Promise<string>((res, rej) => { resolve = res; reject = rej; });
    prompts.set(id, { id, kind, resolve, reject, createdAt: Date.now() });

    ctx.fns.procs.events.emit({ event: {
        type: "secret.prompt",
        id,
        title,
        message: String(opts.message ?? ""),
        kind,
        maxlength: Math.max(1, Math.min(opts.maxlength ?? (kind === "otp" ? 16 : 256), 4096)),
    } });

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            answer,
            new Promise<string>((_, rej) => { timer = setTimeout(() => rej(new Error("secret prompt timed out")), timeoutMs); }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
        prompts.delete(id);
        ctx.fns.procs.events.emit({ event: { type: "secret.prompt.closed", id } });
    }
}
