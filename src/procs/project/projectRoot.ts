import { resolve } from "node:path";

// The project/app root — where package.json + src live, and where genTypes
// writes. Set by boot({root}); falls back to proc's own repo root (so running
// proc itself, or testCtx without boot, just works).
/**
 * Returns the host project root containing `package.json` and `src`.
 * Uses the root supplied to boot, or the framework repository root as a fallback.
 */
export default function (ctx: Context, _session: Session | null, _opts?: {}): string {
    return ctx.state.root ?? resolve(import.meta.dir, "..", "..");
}
