// gdoc.upload — upload a local file to Google Drive (multipart). WRITE OP.
// ctx.fns.gdoc.upload({ path: "/tmp/report.pdf", name?: "Report.pdf", public?: false })
// → { id, name, link, downloadLink, size }
// `public: true` grants anyone-with-link reader access (default false — private).
export default async function (
    ctx: Context,
    session: Session | null,
    opts: { path: string; name?: string; public?: boolean; account?: string },
) {
    if (!opts?.path) throw new Error("gdoc.upload requires { path }");
    const { access_token } = await ctx.fns.google.token({ account: opts.account });
    const file = Bun.file(opts.path);
    if (!(await file.exists())) throw new Error(`File not found: ${opts.path}`);

    const content = await file.arrayBuffer();
    const name = opts.name || opts.path.split("/").pop() || "file";
    const boundary = "-------314159265358979323846";
    const body = new Blob([
        `\r\n--${boundary}\r\n`,
        "Content-Type: application/json; charset=UTF-8\r\n\r\n",
        JSON.stringify({ name }),
        `\r\n--${boundary}\r\n`,
        "Content-Type: application/octet-stream\r\n\r\n",
        content,
        `\r\n--${boundary}--`,
    ]);

    const res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,size",
        { method: "POST", headers: { Authorization: `Bearer ${access_token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body },
    );
    const result: any = await res.json();
    if (!res.ok) throw new Error(`Drive upload error ${res.status}: ${JSON.stringify(result)}`);

    if (opts.public && result.id) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
            method: "POST",
            headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ role: "reader", type: "anyone" }),
        });
    }

    return {
        id: result.id, name: result.name, link: result.webViewLink,
        downloadLink: `https://drive.google.com/uc?export=download&id=${result.id}`,
        size: parseInt(result.size) || content.byteLength,
    };
}
