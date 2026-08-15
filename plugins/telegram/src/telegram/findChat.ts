import { TelegramClient, Api } from "telegram";
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

type FoundChat = {
    /** Marked Telegram peer ID; channels and supergroups use the -100… form accepted by other telegram functions. */
    id: string;
    /** Display title for groups/channels or full name for a direct chat. */
    title: string;
    /** Telegram peer kind. */
    type: "user" | "group" | "supergroup" | "channel";
    /** Public username without @, when present. */
    username: string | null;
    /** Whether Telegram ranked the peer among the user's own contacts/dialogs or global public results. */
    scope: "mine" | "global";
};

/**
 * Finds Telegram chats by title or person name or username with server-side search.
 * Uses the MTProto contacts.Search API across direct messages and groups and
 * supergroups and public channels. This searches chat identities rather than
 * message text. Peers from the user's own contacts and dialogs rank before
 * global public Telegram results. Returned IDs can be passed directly to
 * telegram.messages or telegram.searchChat or telegram.send or
 * telegram.participants.
 *
 * @param opts.query Chat title or person name or username to find. Examples include `ИИшница` and `Pavel` and `@durov`.
 * @param opts.limit Maximum number of matching chats to return. @default 20
 * @returns Matching Telegram peers in server relevance order.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Chat title or person name or username. This does not search message text. */
        query: string;
        /** Maximum number of matching chats. @default 20 */
        limit?: number;
    },
): Promise<FoundChat[]> {
    const query = String(opts?.query ?? "").trim();
    if (!query) throw new Error("findChat: opts.query required");
    const limit = Math.max(1, Math.min(Math.trunc(opts.limit ?? 20), 100));
    const client = await connected(ctx);
    const result: any = await client.invoke(new Api.contacts.Search({ q: query, limit }));

    const entities = new Map<string, any>();
    for (const entity of [...(result.users ?? []), ...(result.chats ?? [])]) {
        const id = entity?.id?.toString();
        if (id) entities.set(`${entity.className === "User" ? "user" : entity.className === "Chat" ? "chat" : "channel"}:${id}`, entity);
    }

    const mine = new Set((result.myResults ?? []).map(peerKey));
    const ordered = [...(result.myResults ?? []), ...(result.results ?? [])];
    const seen = new Set<string>();
    const out: FoundChat[] = [];
    for (const peer of ordered) {
        const key = peerKey(peer);
        if (!key || seen.has(key)) continue;
        const entity = entities.get(key);
        if (!entity) continue;
        seen.add(key);
        out.push({
            id: await client.getPeerId(entity),
            title: entity.className === "User"
                ? [entity.firstName, entity.lastName].filter(Boolean).join(" ") || entity.username || "Unknown user"
                : entity.title || entity.username || "Untitled chat",
            type: entity.className === "User" ? "user" : entity.className === "Chat" ? "group" : entity.megagroup ? "supergroup" : "channel",
            username: entity.username || entity.usernames?.[0]?.username || null,
            scope: mine.has(key) ? "mine" : "global",
        });
        if (out.length >= limit) break;
    }
    return out;
}

function peerKey(peer: any): string {
    if (peer?.userId !== undefined) return `user:${peer.userId.toString()}`;
    if (peer?.chatId !== undefined) return `chat:${peer.chatId.toString()}`;
    if (peer?.channelId !== undefined) return `channel:${peer.channelId.toString()}`;
    return "";
}
