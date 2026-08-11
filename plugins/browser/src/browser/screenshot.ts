import { resolve } from "node:path";

export default async function (
    ctx: Context,
    session: Session | null,
    opts: { session?: string; path?: string; fullPage?: boolean } = {},
): Promise<string> {
    const result = await ctx.fns.cdp.send({
        session: opts.session,
        method: "Page.captureScreenshot",
        params: { format: "png", captureBeyondViewport: opts.fullPage === true },
    });
    if (!result?.data) throw new Error("screenshot: Chrome returned no image data");
    const base = session?.agent?.workspaceDir || process.cwd();
    const path = opts.path ? resolve(base, opts.path) : resolve(base, `.hyper/browser-${Date.now()}.png`);
    await Bun.write(path, Buffer.from(result.data, "base64"));
    return path;
}
