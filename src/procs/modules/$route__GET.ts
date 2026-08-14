// Legacy address; plugins are a product surface now, not framework internals.
/**
 * Handle the GET request for the modules route.
 * @param _opts.req The incoming HTTP request.
 */
export default function (_ctx: Context, _session: Session | null, _opts: { req: Request }) {
    return new Response(null, { status: 308, headers: { location: "/plugins" } });
}
