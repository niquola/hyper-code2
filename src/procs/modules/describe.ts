// How a module presents itself: the tab's label and icon, and the one sentence
// the manager and the agent's index show. The sentence falls back to the
// `description:` a SKILL.md already carries in its frontmatter, so a module that
// is also a skill writes it once.
/**
 * Describe the modules subsystem operation.
 * @param opts.dir The directory to inspect.
 * @param opts.name The target name.
 * @param opts.manifest The module manifest.
 */
export default async function (_ctx: Context, _session: Session | null, opts: { dir: string; name: string; manifest: any }): Promise<{ label: string; icon: string; description: string; place: "left" | "right"; skill: string | null; preview: { files: string; fn: string } | null }> {
    const skill = `${opts.dir}/SKILL.md`;
    const head = await Bun.file(skill).text().then(text => text.slice(0, 800)).catch(() => null);
    return {
        label: opts.manifest.label ?? opts.name.slice(0, 1).toUpperCase() + opts.name.slice(1),
        icon: opts.manifest.icon ?? "ph-squares-four",
        description: opts.manifest.description ?? head?.match(/^description:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "",
        // `"place": "left"` — a module that is part of what somebody is building
        // rather than a tool for building it. The workspace's strip has two
        // groups and this is what says which one; everywhere else it is ignored.
        place: opts.manifest.place === "left" ? "left" : "right",
        skill: head === null ? null : skill,
        // "preview": { "files": "$qr_*.json", "fn": "preview" } — which files this
        // module renders itself, and what to call with { path }.
        preview: opts.manifest.preview?.files && opts.manifest.preview?.fn ? opts.manifest.preview : null,
    };
}
