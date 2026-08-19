/**
 * List files and subfolders in a Google Drive folder.
 *
 * Lists the immediate children of a Drive folder with IDs, types, links, sizes, and timestamps. Use it to inspect My Drive root or navigate a folder hierarchy.
 * @param opts.folder Folder ID or Google Drive folder URL; omit or use root for My Drive root.
 * @param opts.max Maximum children to return. @default 100 @minimum 1 @maximum 1000
 * @param opts.account Google account email; defaults to the configured Google account.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Folder ID or Google Drive folder URL; omit or use root for My Drive root. */
        folder?: string;
        /** Maximum children to return. @default 100 @minimum 1 @maximum 1000 */
        max?: number;
        /** Google account email; defaults to the configured Google account. */
        account?: string;
    },
): Promise<Array<{ id: string; name: string; kind: "folder" | "file"; mimeType: string; link?: string; size?: number; modified?: string }>> {
    const max = Math.max(1, Math.min(opts.max ?? 100, 1000));
    const extractId = (value: string): string => {
        const match = value.match(/\/folders\/([a-zA-Z0-9_-]+)/) || value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        return match ? match[1]! : value.trim();
    };
    const folder = !opts.folder || opts.folder === "root" ? "root" : extractId(opts.folder);
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${folder.replace(/'/g, "\\'")}' in parents and trashed = false`);
    url.searchParams.set("pageSize", String(max));
    url.searchParams.set("orderBy", "folder,name_natural");
    url.searchParams.set("fields", "files(id,name,mimeType,modifiedTime,webViewLink,size)");
    const result = await ctx.fns.gdoc.api({ url: url.toString(), account: opts.account });
    return (result.files ?? []).map((file: any) => ({
        id: file.id,
        name: file.name,
        kind: file.mimeType === "application/vnd.google-apps.folder" ? "folder" as const : "file" as const,
        mimeType: file.mimeType,
        link: file.webViewLink,
        size: file.size ? Number(file.size) : undefined,
        modified: file.modifiedTime,
    }));
}
