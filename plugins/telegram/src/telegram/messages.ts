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

// Read message history of a chat (does NOT mark as read).
// ctx.fns.telegram.messages({ chat: "-1001184192226", max?: 50 })
//   chat: chat id (string or number) or @username.
// Returns oldest→newest within the fetched window.
// → [{ id, date, sender, text, replyTo }]
function senderName(sender: any): string {
    if (!sender) return "Unknown";
    if ("firstName" in sender) return sender.firstName + (sender.lastName ? ` ${sender.lastName}` : "");
    if ("title" in sender) return sender.title;
    return "Unknown";
}

export default async function (ctx: Context, session: Session | null, opts: { chat: string | number; max?: number }) {
    if (opts?.chat === undefined || opts?.chat === null) throw new Error("messages: opts.chat required (chat id or @username)");
    const client = await connected(ctx);
    const msgs = await client.getMessages(String(opts.chat), { limit: opts.max ?? 50 });
    const result: any[] = [];
    for (const msg of [...msgs].reverse()) {
        result.push({
            id: msg.id,
            date: new Date(msg.date * 1000).toISOString(),
            sender: senderName(msg.sender),
            text: msg.message || "[media/no text]",
            hasPhoto: !!(msg as any).photo,   // a downloadable photo (see telegram.photo)
            replyTo: (msg.replyTo as any)?.replyToMsgId,
        });
    }
    return result;
}
