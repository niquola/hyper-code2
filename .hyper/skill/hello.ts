export default async function (_ctx: Context, who: string): Promise<string> {
    return `hello, ${who}!`;
}
