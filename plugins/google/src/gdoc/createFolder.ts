/**
 * Create a Google Drive folder, optionally inside another folder.
 *
 * Creates a private Google Drive folder and returns its ID and browser link. Use this before uploading files into a new Drive hierarchy.
 * @param opts.name Name of the folder to create.
 * @param opts.parent Parent folder ID or Google Drive folder URL; omit to create in My Drive root.
 * @param opts.account Google account email; defaults to the configured Google account.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Name of the folder to create. */
        name: string;
        /** Parent folder ID or Google Drive folder URL; omit to create in My Drive root. */
        parent?: string;
        /** Google account email; defaults to the configured Google account. */
        account?: string;
    },
): Promise<{ id: string; name: string; link: string; parents: string[] }> {
    if (!opts.name?.trim()) throw new Error("createFolder requires a non-empty { name }");
    const extractId = (value: string): string => {
        const match = value.match(/\/folders\/([a-zA-Z0-9_-]+)/) || value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        return match ? match[1]! : value.trim();
    };
    const parent = opts.parent ? extractId(opts.parent) : undefined;
    const result = await ctx.fns.gdoc.api({
        url: "https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink,parents",
        method: "POST",
        body: {
            name: opts.name.trim(),
            mimeType: "application/vnd.google-apps.folder",
            ...(parent ? { parents: [parent] } : {}),
        },
        account: opts.account,
    });
    return { id: result.id, name: result.name, link: result.webViewLink ?? `https://drive.google.com/drive/folders/${result.id}`, parents: result.parents ?? [] };
}
