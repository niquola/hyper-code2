// Execute one declared tool by name and return what the model should see.
//
// The single execution path for BOTH protocols: agent.executeMarker parses a
// §marker into arguments and lands here, and the native JSON tool-call loop
// lands here with the arguments the provider decoded. Validation, error
// capture and NUL scrubbing happen once, here, rather than twice with a drift
// between them.
//
// Never throws for a tool's own failure: a broken call is a message to the
// model, not an exception for the run loop. An unknown name is reported the
// same way, because in JSON mode the model picks the name itself.
export default async function (
    ctx: Context,
    session: Session | null,
    opts: { name: string; args?: any; agent?: types.agent.Agent },
): Promise<{ output: string; content?: types.tools.Content[]; isError: boolean }> {
    const name = String(opts.name ?? "").trim();
    const all = ctx.fns.tools.list({});
    const tool = all.find((t: any) => t.wireName === name || t.name === name || t.key === name);
    if (!tool) {
        return { output: `Error: unknown tool "${name}". Available: ${all.map((t: any) => t.wireName).join(", ")}`, isError: true };
    }

    const args = opts.args ?? {};
    const check = ctx.fns.tools.validate({ schema: tool.parameters, args });
    if (!check.ok) {
        return { output: `Error: invalid arguments for ${tool.wireName} — ${check.errors.join("; ")}`, isError: true };
    }

    // Rules a JSON Schema cannot state live in the tool's own validator.
    if (tool.validate) {
        const validator = String(tool.validate).split(".").reduce((node: any, seg: string) => node?.[seg], ctx.fns as any);
        if (typeof validator !== "function") {
            return { output: `Error: tool "${tool.wireName}" declares validate "${tool.validate}", but nothing is registered under that name`, isError: true };
        }
        const complaints = [await validator({ args })].flat().filter(Boolean);
        if (complaints.length) {
            return { output: `Error: invalid arguments for ${tool.wireName} — ${complaints.join("; ")}`, isError: true };
        }
    }

    // A tool that names an agent runs against that agent's workspace; the
    // derived ctx is what carries it to ctx.fns.files.* and executeBash.
    let callCtx: any = ctx;
    const wanted = opts.agent ? ctx.fns.session.forAgent({ agent: opts.agent }) : session;
    if (wanted && wanted !== (ctx as any).session) {
        callCtx = Object.create(ctx);
        callCtx.session = wanted;
    }

    // Declaration and implementation are separate files, so the fn is resolved
    // through ctx.fns by its dotted name — which also means a hot-reloaded
    // implementation is picked up without touching the declaration.
    const fn = String(tool.fn).split(".").reduce((node: any, seg: string) => node?.[seg], callCtx.fns);
    if (typeof fn !== "function") {
        return { output: `Error: tool "${tool.wireName}" declares fn "${tool.fn}", but nothing is registered under that name`, isError: true };
    }

    let output = "";
    let content: types.tools.Content[] | undefined;
    let isError = false;
    try {
        const r = await fn(args);
        if (typeof r === "string") output = r;
        else {
            output = String(r?.output ?? "");
            if (Array.isArray(r?.content)) content = r.content;
            isError = r?.isError === true;
        }
    } catch (e: any) {
        output = "Error: " + (e?.message ?? String(e));
        isError = true;
    }

    // Postgres text refuses NUL bytes — reading a binary, or bash output that
    // carries one, must not kill the whole run at the INSERT (it did once:
    // agent cm). Replace with U+FFFD.
    output = output.replaceAll("\u0000", "\uFFFD");

    return { output, ...(content?.length ? { content } : {}), isError };
}
