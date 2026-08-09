// `bun script/cli.ts fns` — list the registered functions (ctx.fns.*).
export default function (ctx: Context, _session: Session | null, _opts: any) {
    const out: string[] = [];
    walk((ctx.state as any).registry, [], out);
    return out;
}

function walk(node: any, path: string[], out: string[]) {
    for (const k of Object.keys(node).sort()) {
        const v = node[k];
        if (typeof v === "function") out.push(["ctx.fns", ...path, k].join("."));
        else if (v && typeof v === "object") walk(v, [...path, k], out);
    }
}
