// Compatibility alias; new callers use plugins.read({ name }).
/** Reads plugin metadata and agent instructions (compatibility alias). */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { /** Runtime, plugin, or tool name. */ name: string; /** Value for maxChars. */ maxChars?: number },
): Promise<{ name: string; path: string; text: string; truncated: boolean }> {
    const plugin = await ctx.fns.plugins.read(opts);
    if (!plugin.skill) throw new Error(`plugins.readSkill: "${plugin.name}" ships no SKILL.md`);
    return { name: plugin.name, ...plugin.skill };
}
