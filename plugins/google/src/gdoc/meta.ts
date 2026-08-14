// Drive file metadata for any file id (doc, sheet, pdf, folder…).
// Accepts a bare id or a docs/drive URL.
// ctx.fns.gdoc.meta({ id: "1Bxi...Ms" })
/**
 * Get Google document metadata.
 *
 * @param opts - Options for the operation.
 * @param opts.id - Resource identifier.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts: { id: string; account?: string }) {
    const id = extractId(opts.id);
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${id}`);
    url.searchParams.set(
        "fields",
        "id,name,mimeType,modifiedTime,createdTime,webViewLink,size,owners,lastModifyingUser,parents,trashed,shared",
    );
    const f = await ctx.fns.gdoc.api({ url: url.toString(), account: opts?.account });
    return {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        created: f.createdTime,
        modified: f.modifiedTime,
        link: f.webViewLink,
        size: f.size ? parseInt(f.size) : undefined,
        owner: f.owners?.[0]?.emailAddress,
        lastModifiedBy: f.lastModifyingUser?.emailAddress,
        parents: f.parents,
        trashed: f.trashed,
        shared: f.shared,
    };
}

function extractId(s: string): string {
    const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return m ? m[1]! : s.trim();
}
