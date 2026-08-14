/**
 * Returns a greeting for the requested recipient.
 * @param opts.who Greeting recipient.
 */
export default async function (_ctx: Context, _session: Session | null, opts: { who: string }): Promise<string> {
    return `hello, ${opts.who}!`;
}
