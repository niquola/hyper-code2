// Validate a coerced config against its schema → array of error strings (empty =
// ok). Ported from context-clj system.config/validate: required + type + custom.
const typeValidators: Record<string, (v: any) => boolean> = {
    string: (v) => typeof v === "string",
    "string[]": (v) => Array.isArray(v) && v.every((x) => typeof x === "string"),
    number: (v) => typeof v === "number" && !Number.isNaN(v),
    boolean: (v) => typeof v === "boolean",
    integer: (v) => Number.isInteger(v),
    map: (v) => !!v && typeof v === "object" && !Array.isArray(v),
};

export default function (_ctx: Context, _session: Session | null, opts: { schema: ConfigSchema; config: Record<string, any> }) {
    const { schema, config } = opts;
    const errors: string[] = [];
    for (const [k, s] of Object.entries(schema)) {
        if (s.required && !(k in config)) errors.push(`${k} is required`);
    }
    for (const [k, v] of Object.entries(config)) {
        const s = schema[k];
        if (!s) { errors.push(`${k} — unknown parameter`); continue; }
        const tp = s.type ?? "string";
        const vld = typeValidators[tp];
        if (!vld) errors.push(`${k} — unknown type "${tp}"`);
        else if (!vld(v)) errors.push(`${k} — expected ${tp}, got ${Array.isArray(v) ? "array" : typeof v}`);
        if (s.validator && !s.validator(v)) errors.push(`${k} — failed validator`);
    }
    return errors;
}
