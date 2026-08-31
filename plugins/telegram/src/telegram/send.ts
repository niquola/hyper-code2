import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

async function opSecret(ctx: Context, ref: string) {
    const name = ref.includes("session.txt") ? "session" : ref.includes("config.json") ? "config" : new Bun.CryptoHasher("sha256").update(ref).digest("hex").slice(0, 32);
    const value = await ctx.fns.secrets.get({ ref, namespace: "telegram", name });
    if (!value) throw new Error("Telegram credential is not configured");
    return value;
}

type TelegramClientSingleton = { client?: TelegramClient; connecting?: Promise<TelegramClient> | null };
const telegramClientKey = Symbol.for("hyper-code2.telegram.client.singleton");

async function connected(ctx: Context) {
    const root = globalThis as typeof globalThis & { [telegramClientKey]?: TelegramClientSingleton };
    const cache = (root[telegramClientKey] ??= {});
    // Adopt a pre-singleton client once during hot reload instead of opening the
    // same persisted StringSession a second time in this process.
    const legacy = (ctx.state as any).telegram;
    if (!cache.client?.connected && legacy?.client?.connected) cache.client = legacy.client;
    if (cache.client?.connected) return cache.client;
    if (cache.connecting) return await cache.connecting;
    cache.connecting = (async () => {
        const [configRaw, sessionString] = await Promise.all([
            opSecret(ctx, "op://hyper/telegram config.json/value"),
            opSecret(ctx, "op://hyper/telegram session.txt/value"),
        ]);
        if (!configRaw || !sessionString) throw new Error("Telegram credentials are not configured in 1Password");
        const config = JSON.parse(configRaw);
        const client = new TelegramClient(new StringSession(sessionString.trim()), config.apiId, String(config.apiHash), { connectionRetries: 5 });
        await client.connect();
        if (!(await client.checkAuthorization())) throw new Error("Telegram session is no longer authorized");
        cache.client = client;
        return client;
    })();
    try { return await cache.connecting; } finally { cache.connecting = null; }
}

/**
 * WRITE: send a text message to a chat. ctx.fns.telegram.send({ chat, text })
 *   chat: chat id (string/number) or @username; text: message body.
 *   parseMode: "html" | "md" — format `text` (e.g. <b>…</b>, <blockquote expandable>…</blockquote>).
 *   entities: pre-built MTProto entities (formattingEntities) — takes precedence over parseMode.
 * → { id, date }
 */
/**
 * Sends a Telegram message after write confirmation.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param opts Operation options.
 * @returns The operation result.
 */
export default async function (ctx: Context, session: Session | null, opts: {
        /** Chat identifier or username. */
        chat: string | number;
        /** Message text. */
        text: string;
        /** Message parse mode. */
        parseMode?: "html" | "md";
        /** Telegram message entities. */
        entities?: any[];
        /** Whether the caller confirmed the write operation. */
        confirm?: boolean;
    }) {
    if (opts?.chat === undefined || opts?.chat === null) throw new Error("send: opts.chat required");
    if (!opts?.text) throw new Error("send: opts.text required");
    if (opts.confirm !== true) throw new Error("telegram.send is a real write; repeat with confirm: true after explicit user approval");
    const client = await connected(ctx);
    const params: any = { message: opts.text };
    if (opts.entities) params.formattingEntities = opts.entities;
    else if (opts.parseMode) params.parseMode = opts.parseMode;
    const result: any = await client.sendMessage(String(opts.chat), params);
    return { id: result.id, date: new Date(result.date * 1000).toISOString() };
}
