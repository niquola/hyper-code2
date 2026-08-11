// Run TypeScript inside this process with the live ctx in scope — the agent's
// own extension mechanism. Declared as a tool by $tool_eval.md; callable by
// hand as ctx.fns.tools.eval({ code }).
export default async function (
    ctx: Context,
    session: Session | null,
    opts: { code: string },
): Promise<string | { output: string; content: types.tools.Content[] }> {
    return await ctx.fns.repl.eval({ code: opts.code, agent: (session as any)?.agent });
}
