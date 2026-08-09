// Coerce raw values (strings from env / JSON) to their schema type, applying
// defaults. Ported from context-clj system.config/coerce.
const coercers: Record<string, (v: any) => any> = {
    integer: (v) => (typeof v === "string" && /^[-+]?\d+$/.test(v.trim()) ? parseInt(v, 10) : v),
    number: (v) => (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : v),
    boolean: (v) => (v === "true" ? true : v === "false" ? false : v),
    "string[]": (v) => {
        if (typeof v !== "string") return v;
        let arr: any;
        try { const o = JSON.parse(v); if (Array.isArray(o)) arr = o; } catch { /* not json */ }
        arr ??= v.split(",");
        return arr.map((s: any) => String(s).trim()).filter(Boolean);
    },
    map: (v) => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return v; } },
};

export default function (_ctx: Context, _session: Session | null, opts: { schema: ConfigSchema; config: Record<string, any> }) {
    const { schema, config } = opts;
    const out: Record<string, any> = {};
    for (const [k, s] of Object.entries(schema)) if (s.default !== undefined) out[k] = s.default;
    Object.assign(out, config);
    for (const [k, v] of Object.entries(out)) {
        const tp = schema[k]?.type;
        out[k] = tp && coercers[tp] ? coercers[tp](v) : v;
    }
    return out;
}
