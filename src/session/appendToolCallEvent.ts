export default async function (ctx: Context, _session: Session | null, opts: { id: string; payload: { name: string; args: any; result: string; argsHtml: string; resultHtml: string; isError: boolean; messageIdx?: number }; ts?: number }) {
    return ctx.fns.session.appendEventWithHtml({ id: opts.id, type: "tool_call", payload: opts.payload, ts: opts.ts });
}
