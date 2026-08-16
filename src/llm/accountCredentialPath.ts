import { createHash } from "node:crypto";

/** Resolves the isolated credential location of one subscription account. */
/**
 * Resolve where a named subscription login stores its credentials.
 *
 * The default account preserves the official CLI location. Named accounts live
 * under ~/.hyper/accounts/<provider>/<account>, which can be passed to Codex as
 * CODEX_HOME and to Claude Code as CLAUDE_CONFIG_DIR. Claude Code derives a
 * distinct macOS keychain service from that directory's SHA-256 hash.
 *
 * @param opts.provider Subscription provider: codex, claude-code, or kimi-coding.
 * @param opts.account Credential slot; "default" preserves the CLI default.
 */
export default function (ctx: Context, _session: Session | null, opts: {
    /** Subscription provider name. */ provider: "codex" | "claude-code" | "kimi-coding";
    /** Credential slot. @default "default" */ account?: string;
}): { account: string; dir: string | null; file: string | null; keychainService: string | null } {
    const home = ctx.env.HOME ?? process.env.HOME ?? "";
    const account = String(opts.account ?? "").trim() || "default";
    if (opts.provider === "codex") {
        const dir = account === "default" ? `${home}/.codex` : `${home}/.hyper/accounts/codex/${account}`;
        return { account, dir, file: `${dir}/auth.json`, keychainService: null };
    }
    if (opts.provider === "kimi-coding") {
        const dir = account === "default" ? `${home}/.kimi/credentials` : `${home}/.hyper/accounts/kimi-coding/${account}`;
        return { account, dir, file: `${dir}/kimi-code.json`, keychainService: null };
    }
    if (account === "default") {
        return { account, dir: null, file: null, keychainService: "Claude Code-credentials" };
    }
    const dir = `${home}/.hyper/accounts/claude-code/${account}`;
    const hash = createHash("sha256").update(dir).digest("hex").slice(0, 8);
    return { account, dir, file: null, keychainService: `Claude Code-credentials-${hash}` };
}
