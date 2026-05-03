import { readFileSync, writeFileSync, existsSync } from "node:fs";

// Persist KEY=value pairs to .env (project root) and mirror them on
// `ctx.env` so the running process picks them up immediately.
// Empty value removes the line.
export default function (ctx: Context, opts: { entries: Record<string, string> }): void {
    const entries = opts.entries;
    for (const key of Object.keys(entries)) {
        if (!/^[A-Z][A-Z0-9_]*$/.test(key)) throw new Error(`bad env key: ${key}`);
    }
    const path = ".env";
    let lines = existsSync(path) ? readFileSync(path, "utf8").split("\n") : [];
    for (const [key, value] of Object.entries(entries)) {
        let found = false;
        lines = lines.map(line => {
            const m = /^([A-Z][A-Z0-9_]*)=/.exec(line);
            if (!m || m[1] !== key) return line;
            found = true;
            return value ? `${key}=${escape(value)}` : "";
        }).filter((l, i, arr) => l !== "" || i < arr.length - 1);
        if (!found && value) lines.push(`${key}=${escape(value)}`);
        if (value) ctx.env[key] = value;
        else delete ctx.env[key];
    }
    writeFileSync(path, lines.join("\n").replace(/\n+$/, "\n"));
}

function escape(v: string): string {
    if (/[\s"'#$]/.test(v)) return `"${v.replace(/"/g, '\\"')}"`;
    return v;
}
