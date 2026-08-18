/**
 * Publishes mounted Hyper plugins to coding-harness skill directories
 *
 * Creates collision-safe symlinks for mounted plugin SKILL.md directories and a generated Hyper runtime bridge skill; use to make live Hyper capabilities discoverable by Claude Code, Codex, and compatible harnesses.
 * @param opts.targets Skill roots to update; defaults to existing ~/.agent/skills, ~/.claude/skills, and ~/.codex/skills.
 * @param opts.prefix Prefix for mounted plugin skill names. @default hyper-
 * @param opts.dryRun Report intended changes without writing. @default false
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Skill roots to update; defaults to existing ~/.agent/skills, ~/.claude/skills, and ~/.codex/skills. */
        targets?: string[];
        /** Prefix for mounted plugin skill names. @default hyper- */
        prefix?: string;
        /** Report intended changes without writing. @default false */
        dryRun?: boolean;
    },
): Promise<{ linked: string[]; existing: string[]; collisions: string[]; targets: string[]; bridge: string }> {
    const { homedir } = await import("node:os");
        const { join } = await import("node:path");
        const { mkdir, lstat, readlink, symlink, writeFile } = await import("node:fs/promises");
        const home = ctx.env.HOME || homedir();
        const candidates = opts.targets?.length ? opts.targets : [join(home, ".agent", "skills"), join(home, ".claude", "skills"), join(home, ".codex", "skills")];
        const targets: string[] = [];
        for (const target of candidates) { try { if ((await lstat(target)).isDirectory()) targets.push(target); } catch {} }
        const prefix = opts.prefix ?? "hyper-";
        const linked: string[] = [], existing: string[] = [], collisions: string[] = [];
        const plugins = (ctx.fns.procs.modules.list({}) as any[]).filter((p: any) => p.plugin && p.skill);
        const bridgeRoot = join(ctx.fns.procs.project.runtimeDir({}), "external-skills", "hyper-runtime");
        const bridge = join(bridgeRoot, "SKILL.md");
    const markdown = `---\nname: hyper-runtime\ndescription: Discover and call capabilities from the live local Hyper runtime. Use when a task can benefit from Hyper plugins, authenticated services, research, browser automation, or personal integrations.\n---\n\n# Hyper runtime\n\nUse the live runtime through the \`hyper\` CLI. Start with concise English discovery regardless of the user's language:\n\n\`\`\`sh\nhyper plugin search "capability keywords"\nhyper plugin read <name>\n\`\`\`\n\nCall schema-validated declared tools with \`hyper tools\` and \`hyper tool call <name> --json '{...}'\`. Plugin workflows may call any documented live runtime function through the loopback-only arbitrary REPL: \`hyper repl 'return await ctx.fns.<namespace>.<function>({...})'\`. The REPL is intentionally powerful: use only code required for the task, never print tokens or secrets, and respect confirmation requirements for writes.\n`;
        if (!opts.dryRun) { await mkdir(bridgeRoot, { recursive: true }); await writeFile(bridge, markdown, { mode: 0o600 }); }
        const sources = [{ name: "hyper-runtime", dir: bridgeRoot }, ...plugins.map((p: any) => ({ name: prefix + p.name, dir: p.dir }))];
        for (const target of targets) {
            for (const source of sources) {
                const dst = join(target, source.name);
                let stat: any = null; try { stat = await lstat(dst); } catch {}
                if (stat?.isSymbolicLink()) {
                    const points = await readlink(dst).catch(() => "");
                    if (points === source.dir) { existing.push(dst); continue; }
                    collisions.push(dst); continue;
                }
                if (stat) { collisions.push(dst); continue; }
                if (!opts.dryRun) await symlink(source.dir, dst);
                linked.push(dst);
            }
        }
        return { linked, existing, collisions, targets, bridge };
}
