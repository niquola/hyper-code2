// Run TypeScript inside this process with the live ctx in scope — the agent's
// own extension mechanism. Declared as a tool by $tool_eval.md; callable by
// hand as ctx.fns.tools.eval({ code }).
/** Evaluates TypeScript in the live runtime context. */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: { /** TypeScript or JavaScript code to evaluate. */ code: string },
): Promise<string | { output: string; content: types.tools.Content[] }> {
    return await ctx.fns.repl.eval({ code: opts.code, agent: (session as any)?.agent });
}
