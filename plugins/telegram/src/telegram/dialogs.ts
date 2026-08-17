import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

async function opSecret(ref: string) {
    const path = [`${process.env.HOME}/.local/bin`, "/opt/homebrew/bin", "/usr/local/bin", process.env.PATH ?? ""].join(":");
    const proc = Bun.spawn(["op", "read", "--no-newline", ref], { stdout: "pipe", stderr: "pipe", env: { ...process.env, PATH: path } });
    const [value, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    if (code !== 0) throw new Error("Telegram credential could not be resolved from 1Password");
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
 * List chats/groups/channels (dialogs) ordered by recency.
 * ctx.fns.telegram.dialogs({ max?: 50 })
 * → [{ id, title, type, unreadCount, lastMessage }]
 *   type: supergroup | channel | group | user | <className lowercased>
 *   id is a string (channels/supergroups are negative, e.g. -1001184192226).
 */
function chatType(entity: any): string {
    const cn = entity?.className || "Unknown";
    if (cn === "Channel") return entity.megagroup ? "supergroup" : "channel";
    if (cn === "Chat") return "group";
    if (cn === "User") return "user";
    return cn.toLowerCase();
}

/**
 * Lists Telegram dialogs.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param [opts] Operation options.
 * @returns The operation result.
 */
export default async function (ctx: Context, session: Session | null, opts?: {
        /** Maximum number of results to return. */
        max?: number;
    }) {
    const client = await connected(ctx);
    const dialogs = await client.getDialogs({ limit: opts?.max ?? 50 });
    return dialogs.map((d: any) => ({
        id: d.id?.toString() || "",
        title: d.title || "No title",
        type: chatType(d.entity),
        unreadCount: d.unreadCount,
        lastMessage: d.message?.message?.slice(0, 120) || undefined,
    }));
}
