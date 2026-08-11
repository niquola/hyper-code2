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

// WRITE: create a new chat folder. ctx.fns.telegram.createFolder({ title, chats })
//   title: folder name; chats: array of chat ids/@usernames to include.
// Picks next free folder id automatically; unresolvable chats are skipped.
// → { id, title, peers }
import { Api } from "telegram";

export default async function (ctx: Context, session: Session | null, opts: { title: string; chats: (string | number)[]; confirm?: boolean }) {
    if (!opts?.title) throw new Error("createFolder: opts.title required");
    if (!opts?.chats?.length) throw new Error("createFolder: opts.chats required (at least one chat)");
    if (opts.confirm !== true) throw new Error("telegram.createFolder changes the account; repeat with confirm: true after explicit user approval");
    const client = await connected(ctx);

    const filtersResult: any = await client.invoke(new Api.messages.GetDialogFilters());
    const filters = filtersResult.filters || filtersResult;
    const maxId = filters.reduce((m: number, f: any) => Math.max(m, f.id || 0), 0);
    const newId = maxId + 1;

    const includePeers: any[] = [];
    for (const chat of opts.chats) {
        try {
            includePeers.push(await client.getInputEntity(String(chat)));
        } catch {
            // skip unresolvable peers
        }
    }

    await client.invoke(new Api.messages.UpdateDialogFilter({
        id: newId,
        filter: new Api.DialogFilter({
            id: newId,
            title: new Api.TextWithEntities({ text: opts.title, entities: [] }),
            pinnedPeers: [],
            includePeers,
            excludePeers: [],
        }),
    }));

    return { id: newId, title: opts.title, peers: includePeers.length };
}
