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
 * List members of a Telegram group/channel.
 *   ctx.fns.telegram.participants({ chat: "HS BOT | Самураи умеют отдыхать" })  // by title
 *   ctx.fns.telegram.participants({ chat: 123456 })                             // by id
 * → [{ id, name, username, phone, bot }]
 */
/**
 * Lists participants in a Telegram chat.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param opts Operation options.
 * @returns The operation result.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Chat identifier or username. */
        chat: string | number;
        /** Maximum number of results to return. */
        limit?: number;
    }) {
    const client = await connected(ctx);
    let entity: any = opts.chat;
    if (typeof opts.chat === "string" && !/^-?\d+$/.test(opts.chat)) {
        /**
 * resolve by dialog title
 */
        const dialogs = await client.getDialogs({ limit: 500 });
        const d = dialogs.find((x: any) => (x.title || x.name || "").trim() === opts.chat) ||
                  dialogs.find((x: any) => (x.title || x.name || "").toLowerCase().includes(String(opts.chat).toLowerCase()));
        if (!d) throw new Error(`chat not found: ${opts.chat}`);
        entity = d.entity ?? d.id;
    }
    const parts: any[] = await client.getParticipants(entity, { limit: opts.limit ?? 500 });
    return parts.map((u: any) => ({
        id: u.id?.toString(),
        name: [u.firstName, u.lastName].filter(Boolean).join(" ") || null,
        username: u.username || (u.usernames?.[0]?.username ?? null),
        phone: u.phone || null,
        bot: !!u.bot,
    }));
}
