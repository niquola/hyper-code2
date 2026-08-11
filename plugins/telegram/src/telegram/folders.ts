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

// List chat folders (dialog filters). ctx.fns.telegram.folders({})
// → [{ id, title, emoji, includePeers, excludePeers, pinnedPeers, flags }]
//   flags: contacts | non-contacts | groups | channels | bots | exclude-muted | exclude-read | exclude-archived
import { Api } from "telegram";

function folderTitle(filter: any): string {
    if (typeof filter.title === "string") return filter.title;
    return filter.title?.text || filter.title?.toString() || "Untitled";
}

export default async function (ctx: Context, session: Session | null, _opts?: {}) {
    const client = await connected(ctx);
    const result: any = await client.invoke(new Api.messages.GetDialogFilters());
    const filters = result.filters || result;
    const folders: any[] = [];
    for (const f of filters) {
        if (f.className === "DialogFilterDefault") continue;
        const flags: string[] = [];
        if (f.contacts) flags.push("contacts");
        if (f.nonContacts) flags.push("non-contacts");
        if (f.groups) flags.push("groups");
        if (f.broadcasts) flags.push("channels");
        if (f.bots) flags.push("bots");
        if (f.excludeMuted) flags.push("exclude-muted");
        if (f.excludeRead) flags.push("exclude-read");
        if (f.excludeArchived) flags.push("exclude-archived");
        folders.push({
            id: f.id,
            title: folderTitle(f),
            emoji: f.emoticon || "",
            includePeers: f.includePeers?.length || 0,
            excludePeers: f.excludePeers?.length || 0,
            pinnedPeers: f.pinnedPeers?.length || 0,
            flags,
        });
    }
    return folders;
}
