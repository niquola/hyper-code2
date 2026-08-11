// Compatibility alias; new callers use plugins.read({ name }).
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { name: string; maxChars?: number },
): Promise<{ name: string; path: string; text: string; truncated: boolean }> {
    const plugin = await ctx.fns.plugins.read(opts);
    if (!plugin.skill) throw new Error(`plugins.readSkill: "${plugin.name}" ships no SKILL.md`);
    return { name: plugin.name, ...plugin.skill };
}
