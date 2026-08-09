export default async function (_ctx: Context, _session: Session | null, opts: { text?: string } = {}) {
  return { ok: true, pong: opts.text ?? "pong" };
}