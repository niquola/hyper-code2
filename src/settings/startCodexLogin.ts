import { spawn } from "node:child_process";

// Spawns `codex login --device-auth`, parses the device code + URL from stdout,
// stashes them in ctx.state.settings.codex for the UI to display. The codex
// child process keeps running in the background and writes ~/.codex/auth.json
// itself when the user completes the browser flow.
const URL_RE = /(https?:\/\/[^\s\u001b]+)/;
const CODE_RE = /(?:code|enter[^\n]*?)\s*\u001b\[[0-9;]*m([A-Z0-9]{4,5}-[A-Z0-9]{4,5})/i;

export default async function (ctx: Context): Promise<{
    user_code: string;
    verification_uri: string;
    pid: number;
}> {
    const s = (ctx.state as any).settings ?? ((ctx.state as any).settings = {});
    if (s.codex?.proc?.killed === false && s.codex?.status === "pending") {
        try { s.codex.proc.kill(); } catch { /* ignore */ }
    }

    const proc = spawn("codex", ["login", "--device-auth"], { stdio: ["ignore", "pipe", "pipe"] });
    s.codex = {
        proc,
        status: "pending",
        userCode: null,
        verificationUri: null,
        startedAt: Math.floor(Date.now() / 1000),
        error: null,
    };

    return new Promise<{ user_code: string; verification_uri: string; pid: number }>((resolve, reject) => {
        let buf = "";
        const onData = (chunk: Buffer) => {
            buf += chunk.toString("utf8");
            if (s.codex.userCode && s.codex.verificationUri) return;
            const url = URL_RE.exec(buf)?.[1];
            const code = CODE_RE.exec(buf)?.[1] ?? /\b([A-Z0-9]{4}-[A-Z0-9]{4,5})\b/.exec(buf)?.[1];
            if (url) s.codex.verificationUri = url;
            if (code) s.codex.userCode = code;
            if (s.codex.userCode && s.codex.verificationUri) {
                resolve({
                    user_code: s.codex.userCode,
                    verification_uri: s.codex.verificationUri,
                    pid: proc.pid!,
                });
            }
        };
        proc.stdout.on("data", onData);
        proc.stderr.on("data", onData);

        proc.on("exit", (code) => {
            if (s.codex.status !== "pending") return;
            s.codex.status = code === 0 ? "logged_in" : "failed";
            if (code !== 0) s.codex.error = `codex exited with code ${code}`;
            try { proc.stdout.removeAllListeners("data"); } catch { /* ignore */ }
        });
        proc.on("error", (e) => {
            s.codex.status = "failed";
            s.codex.error = e.message;
            reject(e);
        });

        setTimeout(() => {
            if (!s.codex.userCode || !s.codex.verificationUri) {
                reject(new Error("timed out waiting for codex login prompt"));
            }
        }, 15_000);
    });
}
