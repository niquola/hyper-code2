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
 * Global message search across all chats. ctx.fns.telegram.search({ query, max?: 20 })
 * → [{ id, date, sender, text }]  (sender = chat/user name where match lives)
 */
import { Api } from "telegram";

/**
 * Searches messages across Telegram dialogs.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param opts Operation options.
 * @returns The operation result.
 */
export default async function (ctx: Context, session: Session | null, opts: {
        /** Search query. */
        query: string;
        /** Maximum number of results to return. */
        max?: number;
    }) {
    if (!opts?.query) throw new Error("search: opts.query required");
    const client = await connected(ctx);
    const result: any = await client.invoke(new Api.messages.SearchGlobal({
        q: opts.query,
        filter: new Api.InputMessagesFilterEmpty(),
        minDate: 0,
        maxDate: 0,
        offsetRate: 0,
        offsetPeer: new Api.InputPeerEmpty(),
        offsetId: 0,
        limit: opts.max ?? 20,
    }));

    const names = new Map<string, string>();
    for (const c of result.chats || []) names.set(c.id.toString(), c.title || c.firstName || "");
    for (const u of result.users || []) names.set(u.id.toString(), (u.firstName || "") + (u.lastName ? ` ${u.lastName}` : ""));

    const messages: any[] = [];
    for (const msg of result.messages || []) {
        const peerId = msg.peerId;
        let chatName = "Unknown";
        if (peerId?.channelId) chatName = names.get(peerId.channelId.toString()) || "Channel";
        else if (peerId?.chatId) chatName = names.get(peerId.chatId.toString()) || "Chat";
        else if (peerId?.userId) chatName = names.get(peerId.userId.toString()) || "User";
        messages.push({
            id: msg.id,
            date: new Date(msg.date * 1000).toISOString(),
            sender: chatName,
            text: msg.message || "[media]",
        });
    }
    return messages;
}
