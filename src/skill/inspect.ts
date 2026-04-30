export default async function (ctx: Context, target?: any) {
    return {
        type: typeof target,
        constructor: target?.constructor?.name,
        keys: target ? Object.keys(target) : null,
        json: JSON.stringify(target)?.slice(0, 200)
    };
}