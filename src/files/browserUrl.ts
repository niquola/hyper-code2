/**
 * Builds the canonical path-based Files UI URL for a filesystem path
 *
 * Use when linking a file or directory into the browser-facing Files UI. It resolves relative paths and encodes each absolute path segment while preserving slash separators, allowing browser-relative Markdown and HTML resources to resolve correctly.
 * @param opts.path Relative or absolute filesystem path to expose through the Files UI.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Relative or absolute filesystem path to expose through the Files UI. */
        path: string;
    },
): Promise<string> {
    const absolute = ctx.fns.files.resolveSafe({ path: opts.path });
    const encoded = absolute.split("/").filter(Boolean).map(encodeURIComponent).join("/");
    return "/files/absolute/" + encoded;
}
