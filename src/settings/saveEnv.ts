import { readFileSync, writeFileSync, existsSync } from "node:fs";

// Persist a single KEY=value pair to .env (project root) and mirror it on
// `ctx.env` so the running process picks it up immediately.
// Empty value removes the line.
export default function (ctx: Context, key: string, value: string): void {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) throw new Error(`bad env key: ${key}`);
    const path = ".env";
    const lines = existsSync(path) ? readFileSync(path, "utf8").split("\n") : [];
    let found = false;
    const out = lines.map(line => {
        const m = /^([A-Z][A-Z0-9_]*)=/.exec(line);
        if (!m || m[1] !== key) return line;
        found = true;
        return value ? `${key}=${escape(value)}` : "";
    }).filter(l => l !== "" || lines.indexOf(l) < lines.length - 1);
    if (!found && value) out.push(`${key}=${escape(value)}`);
    writeFileSync(path, out.join("\n").replace(/\n+$/, "\n"));
    if (value) ctx.env[key] = value;
    else delete ctx.env[key];
}

function escape(v: string): string {
    if (/[\s"'#$]/.test(v)) return `"${v.replace(/"/g, '\\"')}"`;
    return v;
}
