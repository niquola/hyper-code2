import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

async function opSecret(ref: string) {
    const path = [`${process.env.HOME}/.local/bin`, "/opt/homebrew/bin", "/usr/local/bin", process.env.PATH ?? ""].join(":");
    const proc = Bun.spawn(["op", "read", "--no-newline", ref], { stdout: "pipe", stderr: "pipe", env: { ...process.env, PATH: path } });
    const [value, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    if (code !== 0) throw new Error("Telegram credential could not be resolved from 1Password");
    return value;
}

async function connected(ctx: Context) {
    const cache = ((ctx.state as any).telegram ??= {});
    if (cache.client?.connected) return cache.client;
    if (cache.connecting) return await cache.connecting;
    cache.connecting = (async () => {
        const [configRaw, sessionString] = await Promise.all([
            opSecret("op://hyper/telegram config.json/value"),
            opSecret("op://hyper/telegram session.txt/value"),
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
