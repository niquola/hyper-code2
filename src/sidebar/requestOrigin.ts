/**
 * Validate loopback transport and browser extension origin for sidebar requests.
 *
 * Reject remote peers and forwarded headers before reading credentials. Requests without a real loopback socket peer fail closed.
 * @param opts.req Incoming HTTP request to check.
 * @param opts.extension Require Chrome extension origin instead of exact Hyper origin.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Incoming HTTP request to check. */
        req: Request;
        /** Require Chrome extension origin instead of exact Hyper origin. */
        extension: boolean;
    },
): Promise<string> {
    const u=new URL(opts.req.url); if(u.protocol!=='http:' || !['127.0.0.1','localhost','[::1]'].includes(u.hostname) || ['forwarded','x-forwarded-host','x-forwarded-for','x-forwarded-proto'].some(h=>opts.req.headers.has(h))) throw new Error('loopback_required');
    const peer=ctx.state.procs?.http?.server?.server?.requestIP(opts.req)?.address;
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer))throw new Error('loopback_required');
    const origin=opts.req.headers.get('origin')??'';
    if(opts.extension ? !/^chrome-extension:\/\/[a-p]{32}$/.test(origin) : origin!==u.origin)throw new Error('origin_rejected');
    return origin;
}
