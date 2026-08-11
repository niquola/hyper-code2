// Close tool calls that never got an answer.
//
// Every provider refuses a transcript where an assistant called a tool and no
// result followed: OpenAI says "No tool output found for function call …",
// Anthropic rejects the unmatched tool_use. And a run CAN die between the two
// writes — the process restarts, the machine sleeps, someone kills it — which
// leaves the agent permanently unable to speak: every later request replays the
// same broken history and 400s again. The agent cannot fix that from inside;
// nothing it says ever reaches the model.
//
// So a dangling call gets a synthetic answer saying what actually happened. The
// history stays honest (the call really was made, its outcome really is
// unknown) and the conversation continues.
export default function (
    _ctx: Context,
    _session: Session | null,
    opts: { messages: any[] },
): { messages: any[]; repaired: { id: string; name: string; afterIdx: number }[] } {
    const messages = opts.messages ?? [];
    const answered = new Set(
        messages.filter((m: any) => m?.role === "tool" && m.tool_call_id != null).map((m: any) => m.tool_call_id),
    );

    const repaired: { id: string; name: string; afterIdx: number }[] = [];
    const out: any[] = [];
    for (const m of messages) {
        out.push(m);
        for (const call of m?.tool_calls ?? []) {
            if (answered.has(call.id)) continue;
            answered.add(call.id);
            repaired.push({ id: call.id, name: call.name, afterIdx: out.length - 1 });
            out.push({
                role: "tool",
                tool_call_id: call.id,
                content: `(no result recorded — the run was interrupted before ${call.name} reported back; re-run it if you still need the answer)`,
                excluded_from_cursor: true,
            });
        }
    }

    return { messages: out, repaired };
}
