/**
 * Absolute path to the Chrome binary for this platform.
 *
 * Override with CHROME_BIN when Chrome lives somewhere unusual.
 */
export default function (ctx: Context, _session: Session | null, _opts?: {}): string {
    if (ctx.env.CHROME_BIN) return ctx.env.CHROME_BIN;
    if (process.platform === "darwin") return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    if (process.platform === "win32") return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    return "google-chrome";
}
