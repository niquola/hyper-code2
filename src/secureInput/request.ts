// Non-blocking variant of secureInput.prompt: the popup opens, the call returns at
// once, and the answer never reaches the agent — it is encrypted into local
// secret storage and the agent is woken with a "secret <ref> is stored" message.
/**
 * Opens a secure-input popup that stores the answer as a secret and wakes the agent, without waiting
 *
 * Use instead of secureInput.prompt when the value should become a durable
 * secret://namespace/name entry (sudo password, API key, account password) and the
 * agent should end its turn while the human types. On Submit the value is encrypted
 * into local secret storage and the requesting agent receives a wake-up message
 * "secret <ref> is stored"; on Cancel it receives "secret <ref> was cancelled". The
 * value itself never enters the transcript. Afterwards use bash({ secrets: { VAR: ref } })
 * or secrets.get({ ref }). One prompt at a time: throws while another is open.
 * @param opts.title Prompt title shown to the human.
 * @param opts.saveAs Destination reference in the form secret://namespace/name.
 * @param opts.message Optional explanatory prompt text.
 * @param opts.kind Input control kind. @default "password"
 * @param opts.maxlength Maximum accepted input length. @minimum 1 @maximum 4096
 * @param opts.agentId Agent to wake when the value arrives; defaults to the current agent.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Prompt title shown to the human. */
        title: string;
        /** Destination reference in the form secret://namespace/name. */
        saveAs: string;
        /** Optional explanatory prompt text. */
        message?: string;
        /** Input control kind. @default "password" */
        kind?: "otp" | "password" | "text";
        /** Maximum accepted input length. @minimum 1 @maximum 4096 */
        maxlength?: number;
        /** Agent to wake when the value arrives; defaults to the current agent. */
        agentId?: string;
    },
): Promise<{ id: string; ref: string; agentId: string }> {
    const title = String(opts?.title ?? "").trim();
    if (!title) throw new Error("secureInput.request: title is required");
    const { namespace, name } = ctx.fns.secrets.parseRef({ ref: opts.saveAs });
    const ref = `secret://${namespace}/${name}`;
    const kind = opts.kind ?? "password";
    if (!["otp", "password", "text"].includes(kind)) throw new Error("secureInput.request: invalid kind");
    const agentId = String(opts.agentId ?? (await ctx.fns.agent.current({})).id);
    const secureState = ((ctx.state as any).secureInput ??= {});
    if (secureState.disabled) throw new Error("transient input prompts are disabled");
    const prompts: Map<string, any> = (secureState.prompts ??= new Map());
    if (prompts.size > 0) throw new Error("secure input prompt already active");
    const closing = secureState.closing as { id: string; until: number } | undefined;
    if (closing && Date.now() < closing.until) throw new Error("previous secure input prompt is still closing in the UI; retry after it is closed");

    const id = Bun.randomUUIDv7().replace(/[^a-zA-Z0-9]/g, "");
    const maxlength = Math.max(1, Math.min(opts.maxlength ?? (kind === "otp" ? 16 : 256), 4096));
    const message = String(opts.message ?? "");
    const displayName = `${ref} → agent ${agentId}`;
    const finish = (text: string) => {
        prompts.delete(id);
        secureState.closing = { id, until: Date.now() + 10_000 };
        ctx.fns.procs.events.emit({ event: { type: "secure-input.prompt.closed", id } });
        return ctx.fns.agent.wakeIn({ id: agentId, delayMs: 1000, reason: text });
    };
    // submit.ts calls resolve/reject exactly like for a blocking prompt; here they
    // store and wake instead of settling a promise somebody awaits.
    prompts.set(id, {
        id, name: displayName, title, message, kind, maxlength, createdAt: Date.now(), agentId, ref,
        resolve: (value: string) => {
            ctx.fns.secrets.set({ ref, value, source: "secure-input" })
                .then(() => finish(`secret ${ref} is stored — use it via bash({ secrets: { VAR: "${ref}" } })`))
                .catch((error: any) => finish(`secret ${ref} could not be stored: ${String(error?.message ?? error)}`));
        },
        reject: (error: Error) => { void finish(`secret ${ref} was cancelled (${error.message})`); },
    });
    ctx.fns.procs.events.emit({ event: { type: "secure-input.prompt", id, name: displayName, title, message, kind, maxlength } });
    return { id, ref, agentId };
}
