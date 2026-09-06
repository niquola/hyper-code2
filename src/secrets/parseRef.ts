/**
 * Parse a secret://namespace/name reference into its local storage coordinates
 *
 * Validates the reference shape used by secrets.set, secrets.get and the bash tool's
 * secrets option. Use it before touching local_secrets so malformed names are
 * rejected with a generic error that never echoes a secret value.
 * @param opts.ref Reference in the form secret://namespace/name.
 */
export default function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Reference in the form secret://namespace/name. */
        ref: string;
    },
): { namespace: string; name: string } {
    const ref = String(opts.ref ?? "").trim();
    const m = /^secret:\/\/([A-Za-z0-9][\w.-]*)\/([A-Za-z0-9][\w.:@-]*)$/.exec(ref);
    if (!m) throw new Error("invalid secret reference: expected secret://namespace/name");
    return { namespace: m[1]!, name: m[2]! };
}
