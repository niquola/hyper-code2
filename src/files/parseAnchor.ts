/** Parses a stable hashline anchor. */
export default function (_ctx: Context, _session: Session | null, opts: { /** Stable line anchor. */ anchor: string }): { line: number; hash: string } {
    const m = String(opts.anchor).trim().match(/^([1-9]\d*)([a-z0-9]{2})$/i);
    if (!m) throw new Error(`invalid anchor: ${opts.anchor}`);
    return { line: Number(m[1]), hash: m[2]!.toLowerCase() };
}