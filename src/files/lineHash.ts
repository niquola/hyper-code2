export default function (_ctx: Context, opts: { line: number; text: string }): string {
    const input = `${opts.line}:${opts.text}`;
    const n = Bun.hash(input);
    const s = n.toString(36);
    return s.slice(0, 2).padStart(2, "0").slice(0, 2);
}