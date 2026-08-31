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
 * Telegram contacts / user lookup (people, not messages).
 *   ctx.fns.telegram.contacts({})                 → all my saved contacts
 *   ctx.fns.telegram.contacts({ query: "Pavel" }) → contacts.Search: matching users (name/@username), incl. global public
 * → [{ id, name, username, phone, mutualContact, contact }]
 */
import { Api } from "telegram";

const user = (u: any) => ({
    id: u.id?.toString(),
    name: [u.firstName, u.lastName].filter(Boolean).join(" ") || null,
    username: u.username || (u.usernames?.[0]?.username ?? null),
    phone: u.phone || null,
    contact: !!u.contact,
    mutualContact: !!u.mutualContact,
    bot: !!u.bot,
});

/**
 * Lists saved contacts or searches Telegram users.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param [opts] Operation options.
 * @returns The operation result.
 */
export default async function (ctx: Context, _session: Session | null, opts?: {
        /** Search query. */
        query?: string;
        /** Maximum number of results to return. */
        limit?: number;
    }) {
    const client = await connected(ctx);
    if (opts?.query) {
        const r: any = await client.invoke(new Api.contacts.Search({ q: opts.query, limit: opts.limit ?? 20 }));
        const ids = new Set([...(r.myResults ?? []), ...(r.results ?? [])].map((p: any) => (p.userId ?? p.channelId ?? p.chatId)?.toString()));
        /**
 * rank: users referenced in results first, then any other returned user
 */
        const users = (r.users ?? []).map(user);
        return users.sort((a: any, b: any) => (ids.has(b.id) ? 1 : 0) - (ids.has(a.id) ? 1 : 0));
    }
    const r: any = await client.invoke(new Api.contacts.GetContacts({ hash: 0 as any }));
    return (r.users ?? []).map(user);
}
