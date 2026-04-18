export default async function (
    ctx: Context,
    code: string,
    bindings: Record<string, any> = {},
) {
    const names = ["ctx", ...Object.keys(bindings)];
    const values: any[] = [ctx, ...Object.values(bindings)];
    try {
        const fn = new Function(...names, `return (async () => (${code}))()`);
        return await fn(...values);
    } catch (e: any) {
        if (!(e instanceof SyntaxError)) throw e;
        const fn = new Function(...names, `return (async () => { ${code} })()`);
        return await fn(...values);
    }
}
