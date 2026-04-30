export default async function (ctx: Context, text: string) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    const lines = text.split('\n').filter(Boolean).length || (text ? 1 : 0);
    return { words, chars, lines };
}