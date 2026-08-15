/** Validates one live runtime function as an authoring and retrieval quality gate. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Dotted runtime function name. */
        name: string;
        /** Throw when structural errors are found. @default false */
        strict?: boolean;
        /** Run project TypeScript diagnostics filtered to the source file. @default false */
        typecheck?: boolean;
        /** Check the durable localization and embedding row. @default false */
        checkIndex?: boolean;
    },
): Promise<{ ok: boolean; name: string; errors: string[]; warnings: string[]; checks: Record<string, any>; metadata: Record<string, any> }> {
    const name = String(opts.name ?? "").trim();
    const errors: string[] = [], warnings: string[] = [];
    let metadata: any;
    try { metadata = ctx.fns.runtime.docs.get({ name }); }
    catch (error: any) { errors.push(String(error?.message ?? error)); metadata = {}; }
    const summary = String(metadata.summary ?? "").trim();
    const doc = String(metadata.doc ?? "").trim();
    const schema = metadata.paramsSchema ?? {};
    const properties = schema.properties ?? {};
    if (!summary || summary.length < 12) errors.push("summary must be a concrete action of at least 12 characters");
    if (/^(performs?|perform|handles?|handle|type-check typecheck|generate gen|load the .+ operation)/i.test(summary)) warnings.push("summary looks generated or tautological; describe the exact capability");
    if (!doc || doc.length < summary.length) errors.push("function JSDoc must describe the supported capability");
    for (const [key, property] of Object.entries(properties) as any) {
        const description = String(property?.description ?? "").trim();
        if (!description || /^(the )?.+ value used by the operation\.?$/i.test(description)) errors.push(`parameter ${key} needs a meaningful JSDoc description`);
    }
    if (!metadata.returnType || metadata.returnType === "unknown") warnings.push("declare a useful return type instead of unknown");
    if (/\bany\b/.test(String(metadata.optsType ?? ""))) warnings.push("opts type contains any; prefer a precise type when possible");
    const expectedRel = name.split(".").join("/") + ".ts";
    if (metadata.rel && metadata.rel !== expectedRel) errors.push(`source path ${metadata.rel} does not match ${expectedRel}`);
    let typecheck: any = null;
    if (opts.typecheck && metadata.rel) {
        typecheck = await ctx.fns.procs.dev.typecheck({ filter: metadata.rel });
        if (!typecheck.ok) errors.push(...typecheck.errors.map((item: string) => `typecheck: ${item}`));
    }
    let index: any = null;
    if (opts.checkIndex && metadata.name) {
        try {
            index = (await ctx.fns.procs.db.select({ sql: `SELECT localized_text, localization_model, embedding IS NOT NULL AS embedded, embedding_model FROM functions WHERE name=?`, params: [name] }) as any[])[0] ?? null;
            if (!index) warnings.push("function has no durable search index row");
            else {
                if (!String(index.localized_text ?? "").trim()) warnings.push("localized retrieval text is missing");
                if (!index.embedded) warnings.push("embedding is missing");
            }
        } catch (error: any) { warnings.push(`index check unavailable: ${String(error?.message ?? error)}`); }
    }
    const report = { ok: errors.length === 0, name, errors, warnings, checks: { metadata: !!metadata.name, parameters: Object.keys(properties).length, typecheck, index }, metadata };
    if (opts.strict && errors.length) throw new Error(`runtime.docs.validate ${name}: ${errors.join("; ")}`);
    return report;
}
