/**
 * Download a photo attached to one Telegram message to a local file.
 */
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
    const [configRaw, sessionString] = await Promise.all([
        opSecret(ctx, "op://hyper/telegram config.json/value"),
        opSecret(ctx, "op://hyper/telegram session.txt/value"),
    ]);
    if (!configRaw || !sessionString) throw new Error("Telegram credentials are not configured");
    const config = JSON.parse(configRaw);
    const client = new TelegramClient(new StringSession(sessionString.trim()), config.apiId, String(config.apiHash), { connectionRetries: 5 });
    await client.connect(); cache.client = client; return client;
}

/**
 * Downloads a photo attached to a Telegram message.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param opts Operation options.
 * @returns The operation result.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Chat identifier or username. */
        chat: string | number;
        /** Numeric identifier. */
        id: number;
        /** Local file path or API path, depending on the operation. */
        path?: string;
    }) {
    if (opts?.chat == null || opts?.id == null) throw new Error("telegram.photo requires chat and id");
    const client = await connected(ctx);
    const [message] = await client.getMessages(String(opts.chat), { ids: [opts.id] });
    if (!message || !(message as any).photo) return null;
    const buffer: any = await client.downloadMedia(message, {});
    if (!buffer?.length) return null;
    const path = opts.path ?? `/tmp/telegram-${opts.id}.jpg`;
    await Bun.write(path, new Uint8Array(buffer));
    return { path, bytes: buffer.length };
}
