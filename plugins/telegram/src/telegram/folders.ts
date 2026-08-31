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
 * List chat folders (dialog filters). ctx.fns.telegram.folders({})
 * → [{ id, title, emoji, includePeers, excludePeers, pinnedPeers, flags }]
 *   flags: contacts | non-contacts | groups | channels | bots | exclude-muted | exclude-read | exclude-archived
 */
import { Api } from "telegram";

function folderTitle(filter: any): string {
    if (typeof filter.title === "string") return filter.title;
    return filter.title?.text || filter.title?.toString() || "Untitled";
}

/**
 * Lists Telegram chat folders.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param [opts] Operation options.
 * @returns The operation result.
 */
export default async function (ctx: Context, session: Session | null, _opts?: {

    }) {
    const client = await connected(ctx);
    const result: any = await client.invoke(new Api.messages.GetDialogFilters());
    const filters = result.filters || result;
    const folders: any[] = [];
    for (const f of filters) {
        if (f.className === "DialogFilterDefault") continue;
        const flags: string[] = [];
        if (f.contacts) flags.push("contacts");
        if (f.nonContacts) flags.push("non-contacts");
        if (f.groups) flags.push("groups");
        if (f.broadcasts) flags.push("channels");
        if (f.bots) flags.push("bots");
        if (f.excludeMuted) flags.push("exclude-muted");
        if (f.excludeRead) flags.push("exclude-read");
        if (f.excludeArchived) flags.push("exclude-archived");
        folders.push({
            id: f.id,
            title: folderTitle(f),
            emoji: f.emoticon || "",
            includePeers: f.includePeers?.length || 0,
            excludePeers: f.excludePeers?.length || 0,
            pinnedPeers: f.pinnedPeers?.length || 0,
            flags,
        });
    }
    return folders;
}
