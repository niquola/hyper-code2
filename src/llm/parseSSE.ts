// Shared Server-Sent-Events frame parser for every LLM stream path
// (streamOpenAI / streamAnthropic / streamCodex). Splits the byte stream on
// blank-line frame boundaries and yields one frame at a time as
// { event, data }, where:
//   - event = the last `event:` line's value, or null if the frame had none
//   - data  = all `data:` lines joined by "\n", each with a single leading
//             space stripped (SSE spec). Handles both "data: x" (OpenAI/
//             Anthropic) and "data:x" (Kimi omits the space).
// Callers do their own JSON.parse / [DONE] / event-dispatch — this only frames.
// Frames with no `data:` line (comments, keepalives) are skipped.
export default async function* (
    _ctx: Context,
    _session: Session | null,
    opts: { body: ReadableStream<Uint8Array> },
): AsyncGenerator<{ event: string | null; data: string }> {
    const decoder = new TextDecoder();
    let buf = "";
    for await (const chunk of opts.body) {
        buf += decoder.decode(chunk, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
            const raw = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            let event: string | null = null;
            const dataLines: string[] = [];
            for (const line of raw.split("\n")) {
                if (line.startsWith("event:")) event = line.slice(6).trim();
                else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
            }
            if (dataLines.length) yield { event, data: dataLines.join("\n") };
        }
    }
}
