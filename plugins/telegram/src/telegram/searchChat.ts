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
 * telegram.searchChat — server-side full-text search WITHIN one chat (MTProto
 * messages.Search). Unlike telegram.search (global SearchGlobal), this is scoped
 * to a peer and pages via offsetId, so you can pull every match for a term.
 *   ctx.fns.telegram.searchChat({ chat: "-1001448431624", query: "память" })
 *   ctx.fns.telegram.searchChat({ chat: "@durov", query: "hi", max: 200 })
 * → [{ id, date, text }] newest→oldest. `max` caps total (paginates in 100s).
 */
import { Api } from "telegram";

/**
 * Searches messages within a Telegram chat.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param opts Operation options.
 * @returns The operation result.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Chat identifier or username. */
        chat: string | number;
        /** Search query. */
        query: string;
        /** Maximum number of results to return. */
        max?: number;
    }) {
    if (opts?.chat === undefined || opts?.chat === null) throw new Error("searchChat: opts.chat required");
    if (!opts?.query) throw new Error("searchChat: opts.query required");
    const client = await connected(ctx);
    const peer = await client.getInputEntity(String(opts.chat));
    const cap = opts.max ?? 100;

    const out: any[] = [];
    let offsetId = 0;
    while (out.length < cap) {
        const res: any = await client.invoke(new Api.messages.Search({
            peer, q: opts.query, filter: new Api.InputMessagesFilterEmpty(),
            minDate: 0, maxDate: 0, offsetId, addOffset: 0,
            limit: Math.min(100, cap - out.length), maxId: 0, minId: 0, hash: 0n as any,
        }));
        const msgs = res.messages ?? [];
        if (!msgs.length) break;
        for (const m of msgs) out.push({ id: m.id, date: new Date(m.date * 1000).toISOString(), text: m.message || "[media]" });
        offsetId = msgs[msgs.length - 1].id;
        if (msgs.length < 100) break;
    }
    return out.slice(0, cap);
}
