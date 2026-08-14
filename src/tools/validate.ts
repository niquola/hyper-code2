// Validate tool arguments against the declared JSON Schema — the subset we
// actually write in `$tool_` declarations: objects with typed properties,
// required, enum, nested objects, arrays with typed items, and
// additionalProperties:false. Errors name the offending path (`edits[0].oldText`)
// so a model can fix the one field instead of re-guessing the whole call.
//
// Deliberately strict about UNKNOWN properties: a model that invents an option
// name has misunderstood the tool, and silently ignoring it produces a call
// that "succeeded" while doing something else. This is also what OpenAI's
// `strict` mode enforces provider-side — here it holds for every provider, and
// for the markers protocol too.
//
// Semantics a schema cannot express ("either path+edits or script") belong in
// the tool's own `validate:` function, not here.
/** Validates tool arguments against a registered schema. */
export default function (
    _ctx: Context,
    _session: Session | null,
    opts: { /** JSON schema used for validation. */ schema: any; /** Command-line arguments. */ args: any },
): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    check(opts.args, opts.schema ?? {}, "", errors);
    return { ok: errors.length === 0, errors };
}

function check(value: any, schema: any, path: string, errors: string[]): void {
    const types: string[] = Array.isArray(schema?.type) ? schema.type : schema?.type ? [schema.type] : [];
    const at = path ? `"${path}" ` : "";

    if (types.includes("object")) {
        if (value == null || typeof value !== "object" || Array.isArray(value)) {
            errors.push(`${at || "arguments "}must be an object, got ${describe(value)}`);
            return;
        }
        const props: Record<string, any> = schema.properties ?? {};
        for (const name of schema.required ?? []) {
            if (value[name] === undefined || value[name] === null) errors.push(`missing required option ${quoted(path, name)}`);
        }
        if (schema.additionalProperties === false) {
            const known = Object.keys(props);
            for (const name of Object.keys(value)) {
                if (known.includes(name)) continue;
                const near = known.filter(k => k.toLowerCase() === name.toLowerCase() || (name.length >= 3 && k.startsWith(name.slice(0, 3))));
                errors.push(
                    `unknown option ${quoted(path, name)}${near.length ? ` — did you mean ${near.map(k => `"${k}"`).join(" or ")}?` : ""}`
                    + `. Known: ${known.join(", ")}`,
                );
            }
        }
        for (const [name, spec] of Object.entries(props)) {
            if (value[name] === undefined || value[name] === null) continue;
            check(value[name], spec, path ? `${path}.${name}` : name, errors);
        }
        return;
    }

    if (types.includes("array")) {
        if (!Array.isArray(value)) {
            errors.push(`${at}must be an array, got ${describe(value)}`);
            return;
        }
        if (schema.items) value.forEach((item, i) => check(item, schema.items, `${path}[${i}]`, errors));
        return;
    }

    if (types.length) {
        const ok = types.some(t =>
            t === "integer" ? Number.isInteger(value) :
            t === "number" ? typeof value === "number" :
            t === "null" ? value === null :
            t === describe(value));
        if (!ok) errors.push(`${at}must be ${types.join(" or ")}, got ${describe(value)}`);
    }

    if (Array.isArray(schema?.enum) && !schema.enum.includes(value)) {
        errors.push(`${at}must be one of ${schema.enum.map((v: any) => JSON.stringify(v)).join(", ")}`);
    }
}

const quoted = (path: string, name: string): string => `"${path ? `${path}.${name}` : name}"`;

function describe(value: any): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
}
