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

// Chats inside a folder, sorted by unreadCount desc. ctx.fns.telegram.folder({ id })
//   id: folder id (number) from telegram.folders.
// → [{ id, title, type, unreadCount, lastMessage }]  (same shape as dialogs)
import { Api } from "telegram";

function chatType(entity: any): string {
    const cn = entity?.className || "Unknown";
    if (cn === "Channel") return entity.megagroup ? "supergroup" : "channel";
    if (cn === "Chat") return "group";
    if (cn === "User") return "user";
    return cn.toLowerCase();
}

export default async function (ctx: Context, session: Session | null, opts: { id: number }) {
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
