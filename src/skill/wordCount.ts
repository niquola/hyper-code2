/**
 * Counts words, characters, and non-empty lines in text.
 * @param opts.text Text input or whether screen text should be included.
 */
export default async function (_ctx: Context, _session: Session | null, opts: { text: string }) {
    const text = opts.text;
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    const lines = text.split('\n').filter(Boolean).length || (text ? 1 : 0);
    return { words, chars, lines };
}
