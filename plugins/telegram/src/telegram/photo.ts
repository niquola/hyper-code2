/**
 * Download a photo attached to one Telegram message to a local file.
 */
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
    const [configRaw, sessionString] = await Promise.all([
        opSecret("op://hyper/telegram config.json/value"),
        opSecret("op://hyper/telegram session.txt/value"),
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
