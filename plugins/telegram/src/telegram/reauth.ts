/**
 * Re-authorize the personal MTProto session. Telegram sends a login code to the
 * user's Telegram app; code and optional 2FA password are collected through a
 * modal form in the current hyper-code browser tab. The resulting StringSession
 * is written directly to 1Password and never returned or persisted on disk.
 */
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { computeCheck } from "telegram/Password";

type ReauthFlight = {
    promise: Promise<any>;
    client?: TelegramClient;
    startedAt: number;
    deadlineAt: number;
    generation: number;
};
type ReauthSingleton = { flight?: ReauthFlight; generation: number };
type TelegramClientSingleton = { client?: TelegramClient; connecting?: Promise<TelegramClient> | null };
const reauthKey = Symbol.for("hyper-code2.telegram.reauth.singleton");
const telegramClientKey = Symbol.for("hyper-code2.telegram.client.singleton");
const globalState = globalThis as typeof globalThis & {
    [reauthKey]?: ReauthSingleton;
    [telegramClientKey]?: TelegramClientSingleton;
};
const reauthSingleton = (globalState[reauthKey] ??= { generation: 0 });
const clientSingleton = (globalState[telegramClientKey] ??= {});

async function opSecret(ref: string) {
    const path = [`${process.env.HOME}/.local/bin`, "/opt/homebrew/bin", "/usr/local/bin", process.env.PATH ?? ""].join(":");
    const proc = Bun.spawn(["op", "read", "--no-newline", ref], { stdout: "pipe", stderr: "pipe", env: { ...process.env, PATH: path } });
    const [value, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    if (code !== 0) throw new Error("Telegram credential could not be resolved from 1Password");
    return value;
}

async function saveSession(session: string) {
    const get = Bun.spawn(["op", "item", "get", "telegram session.txt", "--vault", "hyper", "--format=json", "--reveal"], { stdout: "pipe", stderr: "pipe" });
    const [raw, getError, getCode] = await Promise.all([new Response(get.stdout).text(), new Response(get.stderr).text(), get.exited]);
    if (getCode !== 0) throw new Error(`Could not read Telegram session item from 1Password: ${getError.trim()}`);
    const item = JSON.parse(raw);
    const field = item.fields?.find((x: any) => x.label === "value");
    if (!field) throw new Error("Telegram session item has no concealed value field");
    field.value = session;

    // Piped JSON is the supported 1Password template-edit mode. Do not pass a
    // literal "-" item argument: that edits an item named "-" on some CLI
    // versions and can report success without touching the intended item.
    const edit = Bun.spawn(["op", "item", "edit", item.id, "--vault", "hyper"], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    edit.stdin.write(JSON.stringify(item));
    edit.stdin.end();
    const [editOutput, editError, editCode] = await Promise.all([new Response(edit.stdout).text(), new Response(edit.stderr).text(), edit.exited]);
    if (editCode !== 0) throw new Error(`Could not save Telegram session to 1Password: ${editError.trim() || editOutput.trim()}`);

    // Success is only real after a read-after-write comparison.
    const persisted = (await opSecret("op://hyper/telegram session.txt/value")).trim();
    if (persisted !== session.trim()) throw new Error("Telegram session verification failed after writing to 1Password");
}

async function performReauth(ctx: Context, opts?: { timeoutMs?: number; force?: boolean }) {
    /**
 * Idempotent by default: a valid cached/saved session wins and no login
 */
    /**
 * code is sent. `force` is intentionally explicit for true key rotation.
 */
    if (!opts?.force) {
        try {
            const me: any = await ctx.fns.telegram.me({});
            return {
                authorized: true,
                alreadyAuthorized: true,
                id: me.id ?? "",
                name: [me.firstName, me.lastName].filter(Boolean).join(" "),
                username: me.username || null,
            };
        } catch (error: any) {
            ctx.fns.procs.log.warn({ event: "telegram.reauth.session_invalid", msg: error?.message ?? String(error) });
        }
    }

    const timeoutMs = Math.max(30_000, Math.min(opts?.timeoutMs ?? 300_000, 900_000));
    const configRaw = await opSecret("op://hyper/telegram config.json/value");
    if (!configRaw) throw new Error("Telegram MTProto config is not configured");
    const config = JSON.parse(configRaw);
    if (!Number.isInteger(config.apiId) || !config.apiHash || !config.phone) throw new Error("Telegram config requires apiId, apiHash and phone");

    const legacy = (ctx.state as any).telegram;
    if (!clientSingleton.client?.connected && legacy?.client?.connected) clientSingleton.client = legacy.client;
    const old = clientSingleton.client;
    if (old) await old.disconnect().catch(() => {});
    clientSingleton.client = undefined;
    clientSingleton.connecting = null;
    if (legacy) legacy.client = null;

    /**
 * Direct finite auth flow. Do not use TelegramClient.start(): GramJS wraps
 */
    /**
 * phoneCode/password in hidden while(true) retry loops, which can recreate
 */
    /**
 * browser prompts after the human pressed Cancel.
 */
    const client = new TelegramClient(new StringSession(""), config.apiId, String(config.apiHash), { connectionRetries: 5 });
    if (reauthSingleton.flight) reauthSingleton.flight.client = client;
    try {
        await client.connect();
        const credentials = { apiId: config.apiId, apiHash: String(config.apiHash) };
        const sent = await client.sendCode(credentials, String(config.phone));

        /**
 * A previous emergency stop may have blocked prompts in live state.
 */
        /**
 * We only clear it after SendCode succeeds and this single finite flow
 */
        /**
 * owns the interaction.
 */
        const secureState = ((ctx.state as any).secureInput ??= {});
        delete secureState.disabled;
        delete secureState.cancelledUntil;

        const code = await ctx.fns.secureInput.prompt({
            title: "Telegram login code",
            message: "Enter the code Telegram sent to your Telegram app.",
            kind: "otp",
            timeoutMs,
        });

        let me: any;
        try {
            const auth: any = await client.invoke(new Api.auth.SignIn({
                phoneNumber: String(config.phone),
                phoneCodeHash: sent.phoneCodeHash,
                phoneCode: code,
            }));
            if (!auth?.user) throw new Error("Telegram sign-up is required; reauth only supports existing accounts");
            me = auth.user;
        } catch (error: any) {
            if (error?.errorMessage !== "SESSION_PASSWORD_NEEDED") throw error;
            const passwordInfo: any = await client.invoke(new Api.account.GetPassword());
            const password = await ctx.fns.secureInput.prompt({
                title: "Telegram two-factor password",
                message: passwordInfo?.hint ? `Enter your Telegram 2FA password. Hint: ${passwordInfo.hint}` : "Enter your Telegram 2FA password.",
                kind: "password",
                timeoutMs,
            });
            const check = await computeCheck(passwordInfo, password);
            const auth: any = await client.invoke(new Api.auth.CheckPassword({ password: check }));
            me = auth.user;
        }

        await saveSession(String(client.session.save()));
        clientSingleton.client = client;
        clientSingleton.connecting = null;
        const legacy = ((ctx.state as any).telegram ??= {});
        legacy.client = client;
        return { authorized: true, alreadyAuthorized: false, id: me.id?.toString() ?? "", name: [me.firstName, me.lastName].filter(Boolean).join(" "), username: me.username ?? null, savedTo: "1Password" };
    } catch (error) {
        await client.disconnect().catch(() => {});
        throw error;
    }
}


/**
 * Reauth is process-wide single-flight. The singleton is stored under
 * Symbol.for(), so hot reloads and different runtime contexts cannot start a
 * second Telegram authorization flow or invalidate its auth key.
 */
export default async function (ctx: Context, _session: Session | null, opts?: {
        /** Authorization timeout in milliseconds. */
        timeoutMs?: number;
        /** Whether to force reauthorization. */
        force?: boolean;
    }) {
    const now = Date.now();
    const active = reauthSingleton.flight;
    if (active) {
        if (now <= active.deadlineAt) return await active.promise;
        // A timed-out caller must not leave a hidden GramJS connection alive.
        delete reauthSingleton.flight;
        await active.client?.disconnect().catch(() => {});
    }

    const timeoutMs = Math.max(30_000, Math.min(opts?.timeoutMs ?? 300_000, 900_000));
    const generation = ++reauthSingleton.generation;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const raw = performReauth(ctx, { ...opts, timeoutMs });
    const promise = Promise.race([
        raw,
        new Promise<never>((_, reject) => {
            timer = setTimeout(async () => {
                await reauthSingleton.flight?.client?.disconnect().catch(() => {});
                reject(new Error("Telegram reauthorization timed out"));
            }, timeoutMs + 15_000);
        }),
    ]);
    const flight: ReauthFlight = { promise, startedAt: now, deadlineAt: now + timeoutMs + 15_000, generation };
    reauthSingleton.flight = flight;

    try {
        return await promise;
    } finally {
        if (timer) clearTimeout(timer);
        if (reauthSingleton.flight?.generation === generation) delete reauthSingleton.flight;
    }
}
