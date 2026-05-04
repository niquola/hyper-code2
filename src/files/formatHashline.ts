export default function (ctx: Context, opts: { line: number; text: string }): types.files.ReadAnchorLine {
    const hash = ctx.fns.files.lineHash(ctx, { line: opts.line, text: opts.text });
    return {
        line: opts.line,
        hash,
        anchor: `${opts.line}${hash}`,
        text: opts.text,
    };
}