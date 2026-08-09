export default function (ctx: Context, _session: Session | null, opts: { line: number; text: string }): types.files.ReadAnchorLine {
    const hash = ctx.fns.files.lineHash({ line: opts.line, text: opts.text });
    return {
        line: opts.line,
        hash,
        anchor: `${opts.line}${hash}`,
        text: opts.text,
    };
}