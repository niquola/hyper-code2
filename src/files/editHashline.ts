// Parse the hashline edit DSL (`@<path>` plus anchor ops) and apply it.
//
// The DSL is the §edit marker's body format — a text protocol. Parsing stops
// here: ctx.fns.files.applyEdits takes the op list, so the same operations are
// available to a structured tool call without any text to escape.
/** Parses and applies hashline edit instructions. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { /** Text input to parse. */ input: string },
): Promise<{ path: string; bytes: number; diff: string; content: string }> {
    const parsed = ctx.fns.files.parseHashlineEdit({ input: opts.input });
    return await ctx.fns.files.applyEdits({ path: parsed.path, ops: parsed.ops });
}
