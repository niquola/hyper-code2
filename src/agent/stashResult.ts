// Big marker results don't flood the transcript — the FULL text is stashed into
// agent.scratchpad.results["rN"] (persisted, NOT sent to the model) and the
// transcript gets a preview plus a pointer. §eval binds `agent`, so the model
// reads the rest itself: slice it, grep it, count it — with code, not context.
//   bash keeps the TAIL (errors live at the end); everything else keeps the HEAD.
// Only the last KEEP results are retained so the scratchpad can't grow without
// bound.
const LIMIT = 6_000;      // chars that may enter the transcript verbatim
const PREVIEW = 2_500;    // chars of preview when stashing
const KEEP = 6;           // stashed results retained per agent

export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { agent: types.agent.Agent; output: string; kind: string },
): Promise<string> {
    const { agent, kind } = opts;
    const output = String(opts.output ?? "");
    if (output.length <= LIMIT) return output;

    const pad: any = (agent.scratchpad ??= {});
    const seq = (pad.resultSeq = Number(pad.resultSeq ?? 0) + 1);
    const key = `r${seq}`;
    const results: Record<string, string> = (pad.results ??= {});
    results[key] = output;
    for (const k of Object.keys(results).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))).slice(0, -KEEP)) {
        delete results[k];
    }
    await ctx.fns.session.updateScratchpad({ id: agent.id, scratchpad: pad });

    const lines = output.split("\n");
    const fromTail = kind === "bash";
    // Cut on a line boundary, never mid-line.
    let acc = 0;
    const kept: string[] = [];
    const src = fromTail ? [...lines].reverse() : lines;
    for (const line of src) {
        if (acc + line.length + 1 > PREVIEW) break;
        kept.push(line);
        acc += line.length + 1;
    }
    if (fromTail) kept.reverse();
    const preview = kept.join("\n");
    const kb = (output.length / 1024).toFixed(1);
    const note = `[${fromTail ? "tail" : "head"} of a ${kb} KB / ${lines.length}-line result — FULL text is in agent.scratchpad.results["${key}"]. ` +
        `Read it with §eval, e.g.: const r = agent.scratchpad.results["${key}"]; console.log(r.slice(0, 4000)) — or filter: r.split("\\n").filter(l => l.includes("...")).join("\\n")]`;
    return fromTail ? `${note}\n${preview}` : `${preview}\n${note}`;
}
