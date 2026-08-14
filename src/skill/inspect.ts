/**
 * Returns a compact structural description of a value.
 * @param opts.target Value to inspect.
 */
export default async function (_ctx: Context, _session: Session | null, opts: { target?: any } = {}) {
    const target = opts.target;
    return {
        type: typeof target,
        constructor: target?.constructor?.name,
        keys: target ? Object.keys(target) : null,
        json: JSON.stringify(target)?.slice(0, 200)
    };
}
