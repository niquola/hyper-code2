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

// List members of a Telegram group/channel.
//   ctx.fns.telegram.participants({ chat: "HS BOT | Самураи умеют отдыхать" })  // by title
//   ctx.fns.telegram.participants({ chat: 123456 })                             // by id
// → [{ id, name, username, phone, bot }]
export default async function (ctx: Context, _session: Session | null, opts: { chat: string | number; limit?: number }) {
    const client = await connected(ctx);
    let entity: any = opts.chat;
    if (typeof opts.chat === "string" && !/^-?\d+$/.test(opts.chat)) {
        // resolve by dialog title
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
