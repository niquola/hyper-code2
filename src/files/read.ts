/** Reads a workspace file as text. */
export default async function (ctx: Context, _session: Session | null, opts: { /** Workspace-relative path. */ path: string }): Promise<string> {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    const abs = ctx.fns.files.resolveSafe({ path: opts.path });
    const stat = await Bun.file(abs).stat();

    if (stat && stat.size > MAX_FILE_SIZE) {
        throw new Error(`File too large: ${opts.path} (${(stat.size / 1024 / 1024).toFixed(1)} MB, max ${MAX_FILE_SIZE / 1024 / 1024} MB)`);
    }

    return await Bun.file(abs).text();
}
