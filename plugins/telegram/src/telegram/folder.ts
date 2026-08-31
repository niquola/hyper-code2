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
 * Chats inside a folder, sorted by unreadCount desc. ctx.fns.telegram.folder({ id })
 *   id: folder id (number) from telegram.folders.
 * → [{ id, title, type, unreadCount, lastMessage }]  (same shape as dialogs)
 */
import { Api } from "telegram";

function chatType(entity: any): string {
    const cn = entity?.className || "Unknown";
    if (cn === "Channel") return entity.megagroup ? "supergroup" : "channel";
    if (cn === "Chat") return "group";
    if (cn === "User") return "user";
    return cn.toLowerCase();
}

/**
 * Gets a Telegram chat folder by identifier.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param opts Operation options.
 * @returns The operation result.
 */
export default async function (ctx: Context, session: Session | null, opts: {
        /** Numeric identifier. */
        id: number;
    }) {
    if (opts?.id === undefined || opts?.id === null) throw new Error("folder: opts.id required (folder id from telegram.folders)");
    const client = await connected(ctx);
    const filtersResult: any = await client.invoke(new Api.messages.GetDialogFilters());
    const filters = filtersResult.filters || filtersResult;
    const folder = filters.find((f: any) => f.id === opts.id);
    if (!folder) throw new Error(`Folder ${opts.id} not found`);

    const includePeers = [...(folder.includePeers || []), ...(folder.pinnedPeers || [])];
    if (includePeers.length === 0) return [];

    const folderPeerIds = new Set<string>();
    for (const peer of includePeers) {
        if (peer.userId) folderPeerIds.add(peer.userId.toString());
        if (peer.chatId) folderPeerIds.add((-Number(peer.chatId)).toString());
        if (peer.channelId) folderPeerIds.add((-1000000000000 - Number(peer.channelId)).toString());
    }

    const allDialogs = await client.getDialogs({ limit: 200 });
    const folderDialogs = allDialogs.filter((d: any) => folderPeerIds.has(d.id?.toString() || ""));
    folderDialogs.sort((a: any, b: any) => b.unreadCount - a.unreadCount);

    return folderDialogs.map((d: any) => ({
        id: d.id?.toString() || "",
        title: d.title || "No title",
        type: chatType(d.entity),
        unreadCount: d.unreadCount,
        lastMessage: d.message?.message?.slice(0, 120) || undefined,
    }));
}
