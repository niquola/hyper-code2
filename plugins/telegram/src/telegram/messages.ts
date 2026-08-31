import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

async function opSecret(ctx: Context, ref: string) {
    const value = await ctx.fns.secrets.get({ ref });
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
        if (!Number.isInteger(config.apiId) || !config.apiHash) throw new Error("Telegram MTProto config is invalid");
        const client = new TelegramClient(new StringSession(sessionString.trim()), config.apiId, String(config.apiHash), { connectionRetries: 5 });
        await client.connect();
        if (!(await client.checkAuthorization())) throw new Error("Telegram session is no longer authorized");
        cache.client = client;
        return client;
    })();
    try { return await cache.connecting; } finally { cache.connecting = null; }
}

/**
 * Read message history of a chat (does NOT mark as read).
 * ctx.fns.telegram.messages({ chat: "-1001184192226", max?: 50 })
 *   chat: chat id (string or number) or @username.
 * Returns oldest→newest within the fetched window.
 * → [{ id, date, sender, text, replyTo }]
 */
function senderName(sender: any): string {
    if (!sender) return "Unknown";
    if ("firstName" in sender) return sender.firstName + (sender.lastName ? ` ${sender.lastName}` : "");
    if ("title" in sender) return sender.title;
    return "Unknown";
}

/**
 * Lists recent messages in a Telegram chat.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param opts Operation options.
 * @returns The operation result.
 */
export default async function (ctx: Context, session: Session | null, opts: {
        /** Chat identifier or username. */
        chat: string | number;
        /** Maximum number of results to return. */
        max?: number;
    }) {
    if (opts?.chat === undefined || opts?.chat === null) throw new Error("messages: opts.chat required (chat id or @username)");
    const client = await connected(ctx);
    const msgs = await client.getMessages(String(opts.chat), { limit: opts.max ?? 50 });
    const result: any[] = [];
    for (const msg of [...msgs].reverse()) {
        result.push({
            id: msg.id,
            date: new Date(msg.date * 1000).toISOString(),
            sender: senderName(msg.sender),
            text: msg.message || "[media/no text]",
            hasPhoto: !!(msg as any).photo,   /**
 * a downloadable photo (see telegram.photo)
 */
            replyTo: (msg.replyTo as any)?.replyToMsgId,
        });
    }
    return result;
}
