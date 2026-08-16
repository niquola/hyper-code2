/** Lists functions contributed by one mounted plugin using live runtime metadata. */
export default function (
    ctx: Context,
    _session: Session | null,
    opts: { /** Mounted plugin name or namespace. */ name: string },
): Array<{ name: string; summary: string; signature: string; returnType: string }> {
    return ctx.fns.plugins.docs({ name: opts.name, includeDoc: false }).functions.map((fn: any) => ({
        name: fn.name,
        summary: fn.summary,
        signature: fn.signature,
        returnType: fn.returnType,
    }));
}
