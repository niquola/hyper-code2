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

// Telegram contacts / user lookup (people, not messages).
//   ctx.fns.telegram.contacts({})                 → all my saved contacts
//   ctx.fns.telegram.contacts({ query: "Pavel" }) → contacts.Search: matching users (name/@username), incl. global public
// → [{ id, name, username, phone, mutualContact, contact }]
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

export default async function (ctx: Context, _session: Session | null, opts?: { query?: string; limit?: number }) {
    const client = await connected(ctx);
    if (opts?.query) {
        const r: any = await client.invoke(new Api.contacts.Search({ q: opts.query, limit: opts.limit ?? 20 }));
        const ids = new Set([...(r.myResults ?? []), ...(r.results ?? [])].map((p: any) => (p.userId ?? p.channelId ?? p.chatId)?.toString()));
        // rank: users referenced in results first, then any other returned user
        const users = (r.users ?? []).map(user);
        return users.sort((a: any, b: any) => (ids.has(b.id) ? 1 : 0) - (ids.has(a.id) ? 1 : 0));
    }
    const r: any = await client.invoke(new Api.contacts.GetContacts({ hash: 0 as any }));
    return (r.users ?? []).map(user);
}
