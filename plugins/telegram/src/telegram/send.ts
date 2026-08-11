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

// WRITE: send a text message to a chat. ctx.fns.telegram.send({ chat, text })
//   chat: chat id (string/number) or @username; text: message body.
//   parseMode: "html" | "md" — format `text` (e.g. <b>…</b>, <blockquote expandable>…</blockquote>).
//   entities: pre-built MTProto entities (formattingEntities) — takes precedence over parseMode.
// → { id, date }
export default async function (ctx: Context, session: Session | null, opts: { chat: string | number; text: string; parseMode?: "html" | "md"; entities?: any[]; confirm?: boolean }) {
    if (opts?.chat === undefined || opts?.chat === null) throw new Error("send: opts.chat required");
    if (!opts?.text) throw new Error("send: opts.text required");
    if (opts.confirm !== true) throw new Error("telegram.send is a real write; repeat with confirm: true after explicit user approval");
    const client = await connected(ctx);
    const params: any = { message: opts.text };
    if (opts.entities) params.formattingEntities = opts.entities;
    else if (opts.parseMode) params.parseMode = opts.parseMode;
    const result: any = await client.sendMessage(String(opts.chat), params);
    return { id: result.id, date: new Date(result.date * 1000).toISOString() };
}
