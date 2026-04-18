export default async function (ctx: Context, q: string) {
    return { patched: true, q };
}
