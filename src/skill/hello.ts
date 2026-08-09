export default async function (_ctx: Context, _session: Session | null, opts: { who: string }): Promise<string> {
    return `hello, ${opts.who}!`;
}
