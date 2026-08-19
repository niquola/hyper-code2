/** Collects `$cron_<name>.ts` declarations for reconciliation into `cron_tasks`. */
export default async function (ctx: Context, _session: Session | null, opts: { entries: any[] }): Promise<void> {
    const declarations: Record<string, any> = {};
    for (const entry of opts.entries) {
        const raw = entry.fn ?? (await import(entry.abs + `?t=${Date.now()}`)).default;
        const fn = String(raw?.fn ?? "").trim();
        if (!/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/.test(fn) || raw?.every == null) throw new Error(`${entry.rel}: $cron declaration requires { fn, every }`);
        const everyMs = duration(raw.every);
        if (everyMs < 1000) throw new Error(`${entry.rel}: cron interval must be at least one second`);
        const canonical = JSON.stringify({ fn, args: raw.args ?? {}, everyMs, now: raw.now === true });
        declarations[entry.name] = { name: entry.name, fn, args: raw.args ?? {}, everyMs, now: raw.now === true, sourceFile: entry.rel, definitionHash: Bun.hash(canonical).toString(16) };
    }
    ((ctx.state as any).cron ??= {}).declarations = declarations;
}
function duration(value: string | number): number {
    if (typeof value === "number") return value * 1000;
    let total=0,matched=false,consumed=""; const re=/(\d+)\s*(d|h|m|s)/gi; let match:RegExpExecArray|null;
    while((match=re.exec(value))){matched=true;consumed+=match[0];total+=Number(match[1])*({d:86400000,h:3600000,m:60000,s:1000} as any)[String(match[2]).toLowerCase()];}
    if(!matched||consumed.replace(/\s/g,"").length!==value.replace(/\s/g,"").length) throw new Error(`invalid interval: ${value}`); return total;
}
