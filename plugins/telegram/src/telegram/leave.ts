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
        const client = new TelegramClient(new StringSession(sessionString.trim()), config.apiId, String(config.apiHash), { connectionRetries: 5 });
        await client.connect();
        if (!(await client.checkAuthorization())) throw new Error("Telegram session is no longer authorized");
        cache.client = client;
        return client;
    })();
    try { return await cache.connecting; } finally { cache.connecting = null; }
}

// WRITE: leave a chat/channel/group. ctx.fns.telegram.leave({ chat })
//   chat: chat id (string/number) or @username.
// → { id, left: true }
import { Api } from "telegram";

export default async function (ctx: Context, session: Session | null, opts: { chat: string | number; confirm?: boolean }) {
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
