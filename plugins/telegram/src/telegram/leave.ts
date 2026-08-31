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
        const client = new TelegramClient(new StringSession(sessionString.trim()), config.apiId, String(config.apiHash), { connectionRetries: 5 });
        await client.connect();
        if (!(await client.checkAuthorization())) throw new Error("Telegram session is no longer authorized");
        cache.client = client;
        return client;
    })();
    try { return await cache.connecting; } finally { cache.connecting = null; }
}

/**
 * WRITE: leave a chat/channel/group. ctx.fns.telegram.leave({ chat })
 *   chat: chat id (string/number) or @username.
 * → { id, left: true }
 */
import { Api } from "telegram";

/**
 * Leaves a Telegram chat after write confirmation.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param opts Operation options.
 * @returns The operation result.
 */
export default async function (ctx: Context, session: Session | null, opts: {
        /** Chat identifier or username. */
        chat: string | number;
        /** Whether the caller confirmed the write operation. */
        confirm?: boolean;
    }) {
    if (opts?.chat === undefined || opts?.chat === null) throw new Error("leave: opts.chat required");
    if (opts.confirm !== true) throw new Error("telegram.leave is destructive; repeat with confirm: true after explicit user approval");
    const client = await connected(ctx);
    const entity: any = await client.getInputEntity(String(opts.chat));
    if ("channelId" in entity) {
        await client.invoke(new Api.channels.LeaveChannel({ channel: entity }));
    } else {
        await client.invoke(new Api.messages.DeleteChatUser({
            chatId: entity.chatId,
            userId: new Api.InputUserSelf(),
        }));
    }
    return { id: String(opts.chat), left: true };
}
