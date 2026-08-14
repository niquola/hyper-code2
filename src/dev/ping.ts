/**
 * Returns a small diagnostic response for runtime health checks.
 * @param opts.text Text input or whether screen text should be included.
 */
export default async function (_ctx: Context, _session: Session | null, opts: { text?: string } = {}) {
  return { ok: true, pong: opts.text ?? "pong" };
}