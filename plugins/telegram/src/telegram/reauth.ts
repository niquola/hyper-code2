// Re-authorize the personal MTProto session. Telegram sends a login code to the
// user's Telegram app; code and optional 2FA password are collected through a
// modal form in the current hyper-code browser tab. The resulting StringSession
// is written directly to 1Password and never returned or persisted on disk.
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

async function opSecret(ref: string) {
    const path = [`${process.env.HOME}/.local/bin`, "/opt/homebrew/bin", "/usr/local/bin", process.env.PATH ?? ""].join(":");
    const proc = Bun.spawn(["op", "read", "--no-newline", ref], { stdout: "pipe", stderr: "pipe", env: { ...process.env, PATH: path } });
    const [value, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    if (code !== 0) throw new Error("Telegram credential could not be resolved from 1Password");
    return value;
}

async function saveSession(session: string) {
    const get = Bun.spawn(["op", "item", "get", "telegram session.txt", "--vault", "hyper", "--format=json"], { stdout: "pipe", stderr: "pipe" });
    const [raw, getCode] = await Promise.all([new Response(get.stdout).text(), get.exited]);
    if (getCode !== 0) throw new Error("Could not read Telegram session item from 1Password");
    const item = JSON.parse(raw);
    const field = item.fields?.find((x: any) => x.label === "value");
    if (!field) throw new Error("Telegram session item has no concealed value field");
    field.value = session;
    const edit = Bun.spawn(["op", "item", "edit", "telegram session.txt", "--vault", "hyper", "-"], { stdin: "pipe", stdout: "ignore", stderr: "pipe" });
    edit.stdin.write(JSON.stringify(item));
    edit.stdin.end();
    if (await edit.exited) throw new Error("Could not save Telegram session to 1Password");
}

export default async function (ctx: Context, _session: Session | null, opts?: { timeoutMs?: number }) {
    const timeoutMs = Math.max(30_000, Math.min(opts?.timeoutMs ?? 300_000, 900_000));
    const configRaw = await opSecret("op://hyper/telegram config.json/value");
    if (!configRaw) throw new Error("Telegram MTProto config is not configured");
    const config = JSON.parse(configRaw);
    if (!Number.isInteger(config.apiId) || !config.apiHash || !config.phone) throw new Error("Telegram config requires apiId, apiHash and phone");

    const old = (ctx.state as any).telegram?.client;
    if (old) await old.disconnect().catch(() => {});
    if ((ctx.state as any).telegram) (ctx.state as any).telegram.client = null;

    const client = new TelegramClient(new StringSession(""), config.apiId, String(config.apiHash), { connectionRetries: 5 });
    try {
        await client.start({
            phoneNumber: async () => String(config.phone),
            phoneCode: async () => await ctx.fns.secureInput.prompt({ title: "Telegram login code", message: "Enter the code Telegram sent to your Telegram app.", kind: "otp", timeoutMs }),
            password: async hint => await ctx.fns.secureInput.prompt({ title: "Telegram two-factor password", message: hint ? `Enter your Telegram 2FA password. Hint: ${hint}` : "Enter your Telegram 2FA password.", kind: "password", timeoutMs }),
            onError: async error => { ctx.fns.procs.log.warn({ event: "telegram.reauth.retry", msg: error.message }); return false; },
        });
        const me: any = await client.getMe();
        await saveSession(String(client.session.save()));
        const state = ((ctx.state as any).telegram ??= {});
        state.client = client;
        return { authorized: true, id: me.id?.toString() ?? "", name: [me.firstName, me.lastName].filter(Boolean).join(" "), username: me.username ?? null, savedTo: "1Password" };
    } catch (error) {
        await client.disconnect().catch(() => {});
        throw error;
    }
}
